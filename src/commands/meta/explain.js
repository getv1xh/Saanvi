import { Command } from '#command';
import { ApplicationCommandType } from 'discord.js';
import {
        createExplainMessageId,
        explainMessageOpenRouter,
        explainMessagePayload,
        logger,
        scheduleExplainMessageButtonRemoval,
        storeExplainMessageSource,
} from '#utils';

const MAX_EXPLAIN_CHARS = 3500;

const cleanExplainText = (message) =>
        String(message.cleanContent || message.content || '')
                .replace(/```/g, '`\u200b``')
                .replace(/\s+/g, ' ')
                .trim()
                .slice(0, MAX_EXPLAIN_CHARS);

const formatDuration = (ms) => {
        if (ms < 1000) return `${ms}ms`;
        return `${(ms / 1000).toFixed(1)}s`;
};

const errorPayload = () =>
        explainMessagePayload({
                body: 'I could not explain that right now. Try again in a bit.',
        });

class ExplainCommand extends Command {
        constructor() {
                super({
                        name: 'explain',
                        description: 'Explain a confusing message simply',
                        cooldown: 15,
                        enabledSlash: true,
                        prefix: false,
                        ephemeral: true,
                        slashData: {
                                name: 'Explain',
                                type: ApplicationCommandType.Message,
                        },
                });
        }

        async execute({ ctx }) {
                const message = ctx.interaction.targetMessage;
                const content = message ? cleanExplainText(message) : '';

                if (!message || !content) {
                        return ctx.editReply(
                                explainMessagePayload({
                                        body: 'I can only explain messages with readable text right now.',
                                }),
                        );
                }

                const sourceId = createExplainMessageId();
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
                await storeExplainMessageSource(ctx.client, sourceId, source);
                await ctx.editReply(
                        explainMessagePayload({
                                status: 'Explaining the message...',
                        }),
                );

                const startedAt = Date.now();

                try {
                        const result = await explainMessageOpenRouter({
                                sourceMessage: source,
                        });
                        const payloadOptions = {
                                body: result.answer,
                                footer: `generated in ${formatDuration(Date.now() - startedAt)}`,
                                sourceId,
                                userId: ctx.user.id,
                                includeRetryButton: true,
                        };

                        await storeExplainMessageSource(ctx.client, sourceId, {
                                ...source,
                                previousExplanation: result.answer,
                        });

                        const reply = await ctx.editReply(
                                explainMessagePayload(payloadOptions),
                        );
                        scheduleExplainMessageButtonRemoval(
                                reply,
                                payloadOptions,
                        );
                        return reply;
                } catch (error) {
                        logger.error(
                                'ExplainMessage',
                                `OpenRouter request failed: ${error.message}`,
                                error,
                        );
                        return ctx.editReply(errorPayload());
                }
        }
}

export default new ExplainCommand();
