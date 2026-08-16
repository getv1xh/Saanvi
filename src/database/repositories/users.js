import { User } from '#dbSchema/users';
import { client } from '#src/bot';

const CACHE_TTL = 18000;
const CACHE_PREFIX = 'user:';

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
                                { $setOnInsert: { addresses: {} } },
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
                return { id: _id, ...rest, addresses };
        }
}
