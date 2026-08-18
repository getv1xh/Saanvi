import { Command } from '#command';
import { ApplicationCommandType } from 'discord.js';
import {
        createTranslateMessageId,
        logger,
        scheduleTranslateMessageButtonRemoval,
        storeTranslateMessageSource,
        translateMessageOpenRouter,
        translateMessagePayload,
} from '#utils';

const MAX_TRANSLATE_CHARS = 3500;

const cleanTranslateText = (message) =>
        String(message.cleanContent || message.content || '')
                .replace(/```/g, '`\u200b``')
                .replace(/\s+/g, ' ')
                .trim()
                .slice(0, MAX_TRANSLATE_CHARS);

const formatDuration = (ms) => {
        if (ms < 1000) return `${ms}ms`;
        return `${(ms / 1000).toFixed(1)}s`;
};

const errorPayload = () =>
        translateMessagePayload({
                translation:
                        'I could not translate that right now. Try again in a bit.',
        });

class TranslateCommand extends Command {
        constructor() {
                super({
                        name: 'translate',
                        description: 'Translate a message with AI',
                        cooldown: 15,
                        enabledSlash: true,
                        prefix: false,
                        ephemeral: true,
                        slashData: {
                                name: 'Translate',
                                type: ApplicationCommandType.Message,
                        },
                });
        }

        async execute({ ctx }) {
                const message = ctx.interaction.targetMessage;
                const content = message ? cleanTranslateText(message) : '';

                if (!message || !content) {
                        return ctx.editReply(
                                translateMessagePayload({
                                        translation:
                                                'I can only translate messages with readable text right now.',
                                }),
                        );
                }

                const sourceId = createTranslateMessageId();
                const source = {
                        userId: ctx.user.id,
                        messageId: message.id,
                        channelId: message.channelId,
                        guildId: message.guildId,
                        author:
                                message.author?.tag ||
                                message.author?.username ||
                                'Unknown',
                        content,
                };
                await storeTranslateMessageSource(ctx.client, sourceId, source);
                await ctx.editReply(
                        translateMessagePayload({
                                status: 'Translating to English...',
                        }),
                );

                const startedAt = Date.now();

                try {
                        const result = await translateMessageOpenRouter({
                                sourceMessage: source,
                                targetLanguage: 'English',
                        });
                        const payloadOptions = {
                                translation: result.answer,
                                targetLanguage: 'English',
                                footer: `generated in ${formatDuration(Date.now() - startedAt)}`,
                                sourceId,
                                userId: ctx.user.id,
                                includeButtons: true,
                        };

                        await storeTranslateMessageSource(
                                ctx.client,
                                sourceId,
                                {
                                        ...source,
                                        targetLanguage: 'English',
                                        previousTranslation: result.answer,
                                },
                        );

                        const reply = await ctx.editReply(
                                translateMessagePayload(payloadOptions),
                        );
                        scheduleTranslateMessageButtonRemoval(
                                reply,
                                payloadOptions,
                        );
                        return reply;
                } catch (error) {
                        logger.error(
                                'TranslateMessage',
                                `OpenRouter request failed: ${error.message}`,
                                error,
                        );
                        return ctx.editReply(errorPayload());
                }
        }
}

export default new TranslateCommand();
