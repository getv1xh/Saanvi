import { Command } from '#command';
import { ApplicationCommandType } from 'discord.js';
import { db } from '#dbManager';
import {
        bookmarkPromptPayload,
        createBookmarkSourceId,
        storeBookmarkSource,
} from '#utils';

const messagePreview = (message) => {
        const content = message.content?.trim();
        if (content) {
                return content.length > 180
                        ? `${content.slice(0, 177).trim()}...`
                        : content;
        }

        if (message.attachments?.size) return 'Message has attachments.';
        if (message.embeds?.length) return 'Message has embeds.';
        return 'No readable text found in this message.';
};

const sourceFromMessage = (message) => ({
        messageId: message.id,
        channelId: message.channelId,
        guildId: message.guildId,
        authorId: message.author?.id || null,
        authorTag:
                message.author?.tag ||
                message.author?.username ||
                'Unknown',
        content:
                message.content?.trim() ||
                (message.attachments?.size
                        ? 'Message has attachments.'
                        : message.embeds?.length
                          ? 'Message has embeds.'
                          : 'No readable text.'),
        url: message.url || null,
        createdTimestamp: message.createdTimestamp || null,
});

class BookmarkCommand extends Command {
        constructor() {
                super({
                        name: 'bookmark',
                        description: 'Bookmark a message',
                        cooldown: 5,
                        enabledSlash: true,
                        prefix: false,
                        ephemeral: true,
                        slashData: {
                                name: 'bookmark',
                                type: ApplicationCommandType.Message,
                        },
                });
        }

        async execute({ ctx }) {
                const message = ctx.interaction.targetMessage;
                if (!message) {
                        return ctx.editReply({
                                content: 'I could not read that message.',
                        });
                }

                const sourceId = createBookmarkSourceId();
                await storeBookmarkSource(
                        ctx.client,
                        sourceId,
                        sourceFromMessage(message),
                );

                const bookmarks = await db.user.getBookmarks(ctx.user.id);
                return ctx.editReply(
                        bookmarkPromptPayload({
                                collections: bookmarks.collections,
                                sourceId,
                                userId: ctx.user.id,
                                messagePreview: messagePreview(message),
                        }),
                );
        }
}

export default new BookmarkCommand();
