import { User } from '#dbSchema/users';
import { client } from '#src/bot';

const CACHE_TTL = 18000;
const CACHE_PREFIX = 'user:';
const MAX_BOOKMARK_COLLECTIONS = 4;

const createBookmarkCollectionId = () =>
        `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

const normaliseBookmarks = (bookmarks = {}) => ({
        collections: bookmarks && Array.isArray(bookmarks.collections)
                ? bookmarks.collections.map((collection) => ({
                        id: String(collection.id || createBookmarkCollectionId()),
                        name: String(collection.name || 'Untitled').slice(0, 40),
                        createdAt: collection.createdAt || new Date(),
                        items: Array.isArray(collection.items)
                                ? collection.items.map((item) => ({
                                        messageId: String(item.messageId || ''),
                                        channelId: String(item.channelId || ''),
                                        guildId: item.guildId ? String(item.guildId) : null,
                                        authorId: item.authorId ? String(item.authorId) : null,
                                        authorTag: String(item.authorTag || 'Unknown'),
                                        content: String(item.content || ''),
                                        url: item.url ? String(item.url) : null,
                                        createdTimestamp: item.createdTimestamp || null,
                                        bookmarkedAt: item.bookmarkedAt || new Date(),
                                }))
                                : [],
                }))
                : [],
});

export class UserRepository {
        async findById(userId) {
                if (!userId) return null;

                const cacheKey = `${CACHE_PREFIX}${userId}`;
                const cached = await client.c.get(cacheKey);
                if (cached !== null && cached !== undefined) return cached;

                const user = await User.findById(userId).lean();
                const result = user ? this._normalise(user) : null;
                if (result) await client.c.set(cacheKey, result, CACHE_TTL);

                return result;
        }

        async findOrCreate(userId) {
                if (!userId) throw new Error('Invalid userId');

                let user = await this.findById(userId);
                if (!user) {
                        const doc = await User.findByIdAndUpdate(
                                userId,
                                {
                                        $setOnInsert: {
                                                addresses: {},
                                                bookmarks: { collections: [] },
                                        },
                                },
                                { upsert: true, new: true },
                        ).lean();
                        user = this._normalise(doc);
                        await client.c.set(`${CACHE_PREFIX}${userId}`, user, CACHE_TTL);
                }

                return user;
        }

        async setAddress(userId, chainKey, address) {
                await this.findOrCreate(userId);
                await User.findByIdAndUpdate(userId, { $set: { [`addresses.${chainKey}`]: address } });
                await client.c.del(`${CACHE_PREFIX}${userId}`);
        }

        async removeAddress(userId, chainKey) {
                await User.findByIdAndUpdate(userId, { $unset: { [`addresses.${chainKey}`]: '' } });
                await client.c.del(`${CACHE_PREFIX}${userId}`);
        }

        async getAddress(userId, chainKey) {
                const user = await this.findById(userId);
                return user?.addresses?.[chainKey] ?? null;
        }

        async getAllAddresses(userId) {
                const user = await this.findById(userId);
                return user?.addresses ?? {};
        }

        async getBookmarks(userId) {
                const user = await this.findById(userId);
                return normaliseBookmarks(user?.bookmarks);
        }

        async createBookmarkCollection(userId, name) {
                const user = await this.findOrCreate(userId);
                const bookmarks = normaliseBookmarks(user.bookmarks);

                if (bookmarks.collections.length >= MAX_BOOKMARK_COLLECTIONS) {
                        const error = new Error('Bookmark collection limit reached.');
                        error.code = 'BOOKMARK_COLLECTION_LIMIT';
                        throw error;
                }

                const collection = {
                        id: createBookmarkCollectionId(),
                        name: String(name || 'Untitled').trim().slice(0, 40) || 'Untitled',
                        createdAt: new Date(),
                        items: [],
                };

                bookmarks.collections.push(collection);
                await User.findByIdAndUpdate(userId, { $set: { bookmarks } });
                await client.c.del(`${CACHE_PREFIX}${userId}`);

                return collection;
        }

        async addBookmarkToCollection(userId, collectionId, bookmark) {
                const user = await this.findOrCreate(userId);
                const bookmarks = normaliseBookmarks(user.bookmarks);
                const collection = bookmarks.collections.find((entry) => entry.id === collectionId);

                if (!collection) {
                        const error = new Error('Bookmark collection not found.');
                        error.code = 'BOOKMARK_COLLECTION_NOT_FOUND';
                        throw error;
                }

                const existingIndex = collection.items.findIndex(
                        (item) =>
                                item.messageId === bookmark.messageId &&
                                item.channelId === bookmark.channelId,
                );
                const item = {
                        messageId: String(bookmark.messageId),
                        channelId: String(bookmark.channelId),
                        guildId: bookmark.guildId ? String(bookmark.guildId) : null,
                        authorId: bookmark.authorId ? String(bookmark.authorId) : null,
                        authorTag: String(bookmark.authorTag || 'Unknown'),
                        content: String(bookmark.content || '').slice(0, 1800),
                        url: bookmark.url || null,
                        createdTimestamp: bookmark.createdTimestamp || null,
                        bookmarkedAt: new Date(),
                };

                if (existingIndex >= 0) {
                        collection.items.splice(existingIndex, 1);
                }
                collection.items.unshift(item);

                await User.findByIdAndUpdate(userId, { $set: { bookmarks } });
                await client.c.del(`${CACHE_PREFIX}${userId}`);

                return { collection, item, duplicate: existingIndex >= 0 };
        }

        async deleteBookmarkCollection(userId, collectionId) {
                const user = await this.findOrCreate(userId);
                const bookmarks = normaliseBookmarks(user.bookmarks);
                const collectionIndex = bookmarks.collections.findIndex(
                        (entry) => entry.id === collectionId,
                );

                if (collectionIndex < 0) {
                        const error = new Error('Bookmark collection not found.');
                        error.code = 'BOOKMARK_COLLECTION_NOT_FOUND';
                        throw error;
                }

                const [collection] = bookmarks.collections.splice(collectionIndex, 1);
                await User.findByIdAndUpdate(userId, { $set: { bookmarks } });
                await client.c.del(`${CACHE_PREFIX}${userId}`);

                return collection;
        }

        async getPremiumExpiresAt(userId) {
                const user = await this.findById(userId);
                return user?.premiumExpiresAt ?? null;
        }

        async isPremium(userId) {
                const expiresAt = await this.getPremiumExpiresAt(userId);
                return expiresAt ? new Date(expiresAt).getTime() > Date.now() : false;
        }

        async grantPremium(userId, durationMs) {
                const user = await this.findOrCreate(userId);
                const now = Date.now();
                const current = user.premiumExpiresAt
                        ? new Date(user.premiumExpiresAt).getTime()
                        : 0;
                const startsAt = Math.max(now, current);
                const premiumExpiresAt = new Date(startsAt + durationMs);

                await User.findByIdAndUpdate(userId, { $set: { premiumExpiresAt } });
                await client.c.del(`${CACHE_PREFIX}${userId}`);

                return premiumExpiresAt;
        }

        async revokePremium(userId) {
                await User.findByIdAndUpdate(userId, { $set: { premiumExpiresAt: null } });
                await client.c.del(`${CACHE_PREFIX}${userId}`);
        }

        _normalise(doc) {
                if (!doc) return null;
                const { _id, __v, ...rest } = doc;
                const addresses = rest.addresses instanceof Map
                        ? Object.fromEntries(rest.addresses)
                        : (rest.addresses ?? {});
                return {
                        id: _id,
                        ...rest,
                        addresses,
                        bookmarks: normaliseBookmarks(rest.bookmarks),
                };
        }
}
