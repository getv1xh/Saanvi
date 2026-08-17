import { Command } from '#command';
import { ApplicationCommandType } from 'discord.js';
import {
        createSuggestReplyId,
        storeSuggestReplySource,
        suggestReplyTonePayload,
} from '#utils';

const previewText = (message) => {
        const content = message.content?.trim();
        if (content) {
                return content.length > 160
                        ? `${content.slice(0, 157).trim()}...`
                        : content;
        }

        if (message.attachments?.size) return 'Message has attachments.';
        if (message.embeds?.length) return 'Message has embeds.';
        return 'No readable text found in this message.';
};

class SuggestReplyCommand extends Command {
        constructor() {
                super({
                        name: 'suggestreply',
                        description: 'Suggest a reply to a message',
                        cooldown: 15,
                        enabledSlash: true,
                        prefix: false,
                        slashData: {
                                name: 'Suggest Reply',
                                type: ApplicationCommandType.Message,
                        },
                });
        }

        async execute({ ctx }) {
                const message = ctx.interaction.targetMessage;
                const content = message?.content?.trim();

                if (!message || !content) {
                        return ctx.editReply({
                                content: 'I can only suggest replies for messages with readable text right now.',
                        });
                }

                const sourceId = createSuggestReplyId();
                await storeSuggestReplySource(ctx.client, sourceId, {
                        userId: ctx.user.id,
                        messageId: message.id,
                        channelId: message.channelId,
                        guildId: message.guildId,
                        author:
                                message.author?.tag ||
                                message.author?.username ||
                                'Unknown',
                        content: content.slice(0, 1800),
                });

                return ctx.editReply(
                        suggestReplyTonePayload({
                                sourceId,
                                userId: ctx.user.id,
                                preview: previewText(message),
                        }),
                );
        }
}

export default new SuggestReplyCommand();
