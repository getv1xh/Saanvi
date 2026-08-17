import {
        ActionRowBuilder,
        ButtonBuilder,
        ButtonStyle,
        ContainerBuilder,
        MessageFlags,
        ModalBuilder,
        SeparatorBuilder,
        SeparatorSpacingSize,
        StringSelectMenuBuilder,
        StringSelectMenuOptionBuilder,
        TextDisplayBuilder,
        TextInputBuilder,
        TextInputStyle,
} from 'discord.js';
import { emoji } from '#emoji';

export const BOOKMARK_PREFIX = 'bookmark:';
export const BOOKMARK_SAVE_SELECT_PREFIX = `${BOOKMARK_PREFIX}save`;
export const BOOKMARK_CREATE_PREFIX = `${BOOKMARK_PREFIX}create`;
export const BOOKMARK_CREATE_MODAL_PREFIX = `${BOOKMARK_PREFIX}createmodal`;
export const BOOKMARK_LIST_SELECT_PREFIX = `${BOOKMARK_PREFIX}list`;
export const BOOKMARK_PAGE_PREFIX = `${BOOKMARK_PREFIX}page`;
export const BOOKMARK_NAME_INPUT_ID = 'bookmark_collection_name';
export const BOOKMARK_SOURCE_TTL_SECONDS = 300;
export const MAX_BOOKMARK_COLLECTIONS = 4;
export const BOOKMARK_PAGE_SIZE = 3;

const BOOKMARK_ICON = '<:book_icon:1538871828028588042>';
const WARN_ICON = '<:warn:1538166311916544070>';

const parseEmoji = (value) => {
        const custom = String(value || '').match(/^<a?:(\w+):(\d+)>$/);
        if (custom) {
                return {
                        name: custom[1],
                        id: custom[2],
                        animated: value.startsWith('<a:'),
                };
        }
        return { name: value || 'bookmark' };
};

const customId = (...parts) =>
        parts
                .filter((part) => part !== null && part !== undefined)
                .map((part) => String(part).replace(/:+$/g, ''))
                .join(':');

const truncate = (value, max) => {
        const text = String(value || '').trim();
        if (text.length <= max) return text;
        return `${text.slice(0, Math.max(0, max - 3)).trim()}...`;
};

const codeSafe = (value) =>
        String(value || 'No readable text.')
                .replace(/```/g, "`\u200b``")
                .slice(0, 900);

const preview = (value) => truncate(value || 'No readable text.', 180);

const collectionOptions = (collections) =>
        collections.slice(0, MAX_BOOKMARK_COLLECTIONS).map((collection) =>
                new StringSelectMenuOptionBuilder()
                        .setLabel(truncate(collection.name, 80))
                        .setDescription(
                                `${collection.items?.length || 0} saved message${(collection.items?.length || 0) === 1 ? '' : 's'}`,
                        )
                        .setValue(collection.id)
                        .setEmoji(parseEmoji(BOOKMARK_ICON)),
        );

export const bookmarkSourceKey = (sourceId) => `bookmark:source:${sourceId}`;

export const createBookmarkSourceId = () =>
        `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export const storeBookmarkSource = async (client, sourceId, source) => {
        await client.c.set(
                bookmarkSourceKey(sourceId),
                JSON.stringify({ ...source, updatedAt: Date.now() }),
                BOOKMARK_SOURCE_TTL_SECONDS,
        );
};

export const parseStoredBookmarkSource = (raw) => {
        if (!raw) return null;
        if (typeof raw === 'object') return raw;

        try {
                return JSON.parse(raw);
        } catch {
                return null;
        }
};

export const noBookmarksPayload = () => {
        const container = new ContainerBuilder()
                .setAccentColor(0xffffff)
                .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                                `${WARN_ICON} **No book mark message.**`,
                        ),
                );

        return {
                components: [container],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
                allowedMentions: { parse: [] },
        };
};

export const bookmarkLimitPayload = () => {
        const container = new ContainerBuilder()
                .setAccentColor(0xffffff)
                .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                                `${WARN_ICON} **Collection limit reached.**\nYou can keep up to ${MAX_BOOKMARK_COLLECTIONS} bookmark collections.`,
                        ),
                );

        return {
                components: [container],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
                allowedMentions: { parse: [] },
        };
};

export const bookmarkExpiredPayload = () => {
        const container = new ContainerBuilder()
                .setAccentColor(0xffffff)
                .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                                `${WARN_ICON} **Bookmark session expired.**\nUse the message context menu again.`,
                        ),
                );

        return {
                components: [container],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
                allowedMentions: { parse: [] },
        };
};

export const bookmarkPromptPayload = ({
        collections = [],
        sourceId,
        userId,
        messagePreview,
}) => {
        const hasCollections = collections.length > 0;
        const canCreate = collections.length < MAX_BOOKMARK_COLLECTIONS;
        const container = new ContainerBuilder()
                .setAccentColor(0xffffff)
                .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                                `${BOOKMARK_ICON} **Bookmark**\n` +
                                        (hasCollections
                                                ? 'Choose a collection or create a new one.'
                                                : 'Create your first collection to save this message.'),
                        ),
                )
                .addSeparatorComponents(
                        new SeparatorBuilder()
                                .setSpacing(SeparatorSpacingSize.Small)
                                .setDivider(true),
                )
                .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                                `-# ${preview(messagePreview)}`,
                        ),
                );

        if (hasCollections) {
                container.addActionRowComponents(
                        new ActionRowBuilder().addComponents(
                                new StringSelectMenuBuilder()
                                        .setCustomId(
                                                customId(
                                                        BOOKMARK_SAVE_SELECT_PREFIX,
                                                        sourceId,
                                                        userId,
                                                ),
                                        )
                                        .setPlaceholder('Choose collection')
                                        .addOptions(collectionOptions(collections)),
                        ),
                );
        }

        container.addActionRowComponents(
                new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                                .setCustomId(
                                        customId(
                                                BOOKMARK_CREATE_PREFIX,
                                                sourceId,
                                                userId,
                                        ),
                                )
                                .setLabel('New Collection')
                                .setEmoji(parseEmoji(BOOKMARK_ICON))
                                .setStyle(ButtonStyle.Secondary)
                                .setDisabled(!canCreate),
                ),
        );

        return {
                components: [container],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
                allowedMentions: { parse: [] },
        };
};

export const bookmarkCreateCollectionModal = (sourceId, userId) =>
        new ModalBuilder()
                .setCustomId(
                        customId(BOOKMARK_CREATE_MODAL_PREFIX, sourceId, userId),
                )
                .setTitle('New Bookmark Collection')
                .addComponents(
                        new ActionRowBuilder().addComponents(
                                new TextInputBuilder()
                                        .setCustomId(BOOKMARK_NAME_INPUT_ID)
                                        .setLabel('Collection name')
                                        .setStyle(TextInputStyle.Short)
                                        .setMinLength(1)
                                        .setMaxLength(40)
                                        .setRequired(true),
                        ),
                );

export const bookmarkSavedPayload = ({
        collection,
        item,
        duplicate = false,
}) => {
        const container = new ContainerBuilder()
                .setAccentColor(0xffffff)
                .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                                `${BOOKMARK_ICON} **Bookmarked**\n` +
                                        `${duplicate ? 'Updated in' : 'Saved to'} **${collection.name}**.`,
                        ),
                )
                .addSeparatorComponents(
                        new SeparatorBuilder()
                                .setSpacing(SeparatorSpacingSize.Small)
                                .setDivider(true),
                )
                .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                                `**${item.authorTag}**\n\`\`\`\n${codeSafe(item.content)}\n\`\`\``,
                        ),
                );

        if (item.url) {
                container.addActionRowComponents(
                        new ActionRowBuilder().addComponents(
                                new ButtonBuilder()
                                        .setLabel('Open Message')
                                        .setURL(item.url)
                                        .setStyle(ButtonStyle.Link),
                        ),
                );
        }

        return {
                components: [container],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
                allowedMentions: { parse: [] },
        };
};

export const bookmarksCollectionMenuPayload = (collections = [], userId) => {
        const visibleCollections = collections.filter(
                (collection) => collection.items?.length,
        );
        if (!visibleCollections.length) return noBookmarksPayload();

        const totalMessages = visibleCollections.reduce(
                (sum, collection) => sum + (collection.items?.length || 0),
                0,
        );
        const container = new ContainerBuilder()
                .setAccentColor(0xffffff)
                .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                                `${BOOKMARK_ICON} **Bookmarks**\n${totalMessages} saved message${totalMessages === 1 ? '' : 's'} across ${visibleCollections.length} collection${visibleCollections.length === 1 ? '' : 's'}.`,
                        ),
                )
                .addSeparatorComponents(
                        new SeparatorBuilder()
                                .setSpacing(SeparatorSpacingSize.Small)
                                .setDivider(true),
                )
                .addActionRowComponents(
                        new ActionRowBuilder().addComponents(
                                new StringSelectMenuBuilder()
                                        .setCustomId(
                                                customId(
                                                        BOOKMARK_LIST_SELECT_PREFIX,
                                                        userId,
                                                ),
                                        )
                                        .setPlaceholder('Select collection')
                                        .addOptions(
                                                collectionOptions(
                                                        visibleCollections,
                                                ),
                                        ),
                        ),
                );

        return {
                components: [container],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
                allowedMentions: { parse: [] },
        };
};

const pageNavRow = ({ collectionId, page, totalPages, userId }) =>
        new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                        .setCustomId(
                                customId(
                                        BOOKMARK_PAGE_PREFIX,
                                        collectionId,
                                        Math.max(1, page - 1),
                                        userId,
                                ),
                        )
                        .setEmoji(parseEmoji(emoji.pg_prev))
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(page <= 1),
                new ButtonBuilder()
                        .setCustomId(customId(BOOKMARK_PAGE_PREFIX, 'label', page))
                        .setLabel(`${page} / ${totalPages}`)
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true),
                new ButtonBuilder()
                        .setCustomId(
                                customId(
                                        BOOKMARK_PAGE_PREFIX,
                                        collectionId,
                                        Math.min(totalPages, page + 1),
                                        userId,
                                ),
                        )
                        .setEmoji(parseEmoji(emoji.pg_next))
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(page >= totalPages),
        );

export const bookmarksCollectionPagePayload = ({
        collection,
        page = 1,
        userId,
}) => {
        if (!collection?.items?.length) return noBookmarksPayload();

        const totalPages = Math.max(
                1,
                Math.ceil(collection.items.length / BOOKMARK_PAGE_SIZE),
        );
        const currentPage = Math.max(1, Math.min(totalPages, Number(page) || 1));
        const start = (currentPage - 1) * BOOKMARK_PAGE_SIZE;
        const items = collection.items.slice(start, start + BOOKMARK_PAGE_SIZE);
        const lines = items.map((item, index) => {
                const number = start + index + 1;
                const timestamp = item.createdTimestamp
                        ? ` <t:${Math.floor(item.createdTimestamp / 1000)}:R>`
                        : '';
                const channel = item.channelId ? ` <#${item.channelId}>` : '';
                const link = item.url ? `\n[Open Message](${item.url})` : '';
                return (
                        `**${number}. ${item.authorTag}**${timestamp}${channel}\n` +
                        `\`\`\`\n${codeSafe(item.content)}\n\`\`\`${link}`
                );
        });

        const container = new ContainerBuilder()
                .setAccentColor(0xffffff)
                .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                                `${BOOKMARK_ICON} **${collection.name}**\n${collection.items.length} saved message${collection.items.length === 1 ? '' : 's'}`,
                        ),
                )
                .addSeparatorComponents(
                        new SeparatorBuilder()
                                .setSpacing(SeparatorSpacingSize.Small)
                                .setDivider(true),
                )
                .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(lines.join('\n\n')),
                );

        if (totalPages > 1) {
                container.addSeparatorComponents(
                        new SeparatorBuilder()
                                .setSpacing(SeparatorSpacingSize.Small)
                                .setDivider(true),
                );
                container.addActionRowComponents(
                        pageNavRow({
                                collectionId: collection.id,
                                page: currentPage,
                                totalPages,
                                userId,
                        }),
                );
        }

        return {
                components: [container],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
                allowedMentions: { parse: [] },
        };
};
