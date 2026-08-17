import { Command } from '#command';
import {
        ApplicationCommandOptionType,
        ContainerBuilder,
        TextDisplayBuilder,
        MessageFlags,
} from 'discord.js';
import { askOpenRouter, logger } from '#utils';

const LOADING_EMOJI = '<a:loading:1538534708739051562>';

const formatDuration = (ms) => {
        if (ms < 1000) return `${ms}ms`;
        return `${(ms / 1000).toFixed(1)}s`;
};

const openRouterErrorMessage = (error) => {
        if (error.message.includes('OPENROUTER_API_KEY')) {
                return '`OPENROUTER_API_KEY` is missing in the bot environment.';
        }

        if (error.status === 403 && /limit exceeded/i.test(error.message)) {
                return 'OpenRouter rejected the request because the API key limit has been exceeded.';
        }

        if (error.status === 429) {
                return 'OpenRouter or the selected model is rate-limited right now. Try again later or use a different `/ask` model.';
        }

        return 'I could not get an answer from OpenRouter right now.';
};

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
                                                description: 'What should Saanvi answer?',
                                                required: true,
                                                max_length: 1000,
                                        },
                                        {
                                                type: ApplicationCommandOptionType.Boolean,
                                                name: 'web',
                                                description: 'Use web search for current info. This may use OpenRouter credits.',
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
                        return ctx.reply({
                                components: [this._container('Please send a question for me to answer.')],
                                flags: MessageFlags.IsComponentsV2,
                        });
                }

                const startedAt = Date.now();

                await ctx.reply({
                        components: [
                                this._container(
                                        `${LOADING_EMOJI} **Thinking...**`,
                                ),
                        ],
                        flags: MessageFlags.IsComponentsV2,
                });

                try {
                        const result = await askOpenRouter({ question, useWeb });
                        const duration = formatDuration(Date.now() - startedAt);

                        return ctx.editReply({
                                components: [
                                        this._container(
                                                result.answer,
                                                `generated in ${duration}`,
                                        ),
                                ],
                                flags: MessageFlags.IsComponentsV2,
                        });
                } catch (error) {
                        logger.error('Ask', `OpenRouter request failed: ${error.message}`, error);
                        const duration = formatDuration(Date.now() - startedAt);

                        return ctx.editReply({
                                components: [
                                        this._container(
                                                openRouterErrorMessage(error),
                                                `failed after ${duration}`,
                                        ),
                                ],
                                flags: MessageFlags.IsComponentsV2,
                        });
                }
        }

        _container(body, footer = null) {
                const container = new ContainerBuilder()
                        .setAccentColor(0xffffff)
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(body));

                if (footer) {
                        container.addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(`-# ${footer}`),
                        );
                }

                return container;
        }
}

export default new AskCommand();
