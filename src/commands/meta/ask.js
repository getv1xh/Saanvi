import { Command } from '#command';
import { ApplicationCommandOptionType, MessageFlags } from 'discord.js';
import {
        askOpenRouter,
        askResponsePayload,
        createAskConversationId,
        logger,
        scheduleAskReplyButtonRemoval,
        storeAskConversation,
} from '#utils';

const LOADING_EMOJI = '<a:loading:1538534708739051562>';

const formatDuration = (ms) => {
        if (ms < 1000) return `${ms}ms`;
        return `${(ms / 1000).toFixed(1)}s`;
};

const openRouterErrorMessage = () =>
        'I could not answer that right now. Try again in a bit.';

class AskCommand extends Command {
        constructor() {
                super({
                        name: 'ask',
                        description: 'Ask Saanvi a question using AI',
                        cooldown: 15,
                        enabledSlash: true,
                        slashData: {
                                name: 'ask',
                                description: 'Ask Saanvi a question using AI',
                                options: [
                                        {
                                                type: ApplicationCommandOptionType.String,
                                                name: 'question',
                                                description:
                                                        'What should Saanvi answer?',
                                                required: true,
                                                max_length: 1000,
                                        },
                                        {
                                                type: ApplicationCommandOptionType.Boolean,
                                                name: 'web',
                                                description:
                                                        'Use web search for current info.',
                                                required: false,
                                        },
                                ],
                        },
                });
        }

        async execute({ ctx }) {
                const question = ctx.options.getString('question', true).trim();
                const useWeb = ctx.options.getBoolean('web') ?? false;

                if (!question) {
                        return ctx.reply(
                                askResponsePayload({
                                        body: 'Please send a question for me to answer.',
                                }),
                        );
                }

                const startedAt = Date.now();

                await ctx.reply({
                        components: [
                                askResponsePayload({
                                        body: `${LOADING_EMOJI} **Thinking...**`,
                                }).components[0],
                        ],
                        flags: MessageFlags.IsComponentsV2,
                });

                try {
                        const result = await askOpenRouter({
                                question,
                                useWeb,
                        });
                        const duration = formatDuration(Date.now() - startedAt);
                        const conversationId = createAskConversationId();
                        const payloadOptions = {
                                body: result.answer,
                                footer: `generated in ${duration}`,
                                conversationId,
                                userId: ctx.user.id,
                                includeReplyButton: true,
                        };

                        await storeAskConversation(ctx.client, conversationId, {
                                userId: ctx.user.id,
                                useWeb,
                                messages: [
                                        { role: 'user', content: question },
                                        {
                                                role: 'assistant',
                                                content: result.answer,
                                        },
                                ],
                        });

                        const reply = await ctx.editReply(
                                askResponsePayload(payloadOptions),
                        );
                        scheduleAskReplyButtonRemoval(reply, payloadOptions);
                        return reply;
                } catch (error) {
                        logger.error(
                                'Ask',
                                `OpenRouter request failed: ${error.message}`,
                                error,
                        );
                        return ctx.editReply(
                                askResponsePayload({
                                        body: openRouterErrorMessage(),
                                }),
                        );
                }
        }
}

export default new AskCommand();
