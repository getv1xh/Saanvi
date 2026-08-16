import { Command } from '#command';
import {
        ApplicationCommandOptionType,
        ContainerBuilder,
        SeparatorBuilder,
        SeparatorSpacingSize,
        TextDisplayBuilder,
        MessageFlags,
} from 'discord.js';
import { askOpenRouter, logger } from '#utils';

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
                                components: [this._container('Ask', 'Please send a question for me to answer.')],
                                flags: MessageFlags.IsComponentsV2,
                        });
                }

                try {
                        const result = await askOpenRouter({ question, useWeb });
                        const mode = result.usedWeb ? 'web on' : 'web off';

                        return ctx.reply({
                                components: [
                                        this._container(
                                                'Ask',
                                                result.answer,
                                                `model: \`${result.model}\` | ${mode}`,
                                        ),
                                ],
                                flags: MessageFlags.IsComponentsV2,
                        });
                } catch (error) {
                        logger.error('Ask', `OpenRouter request failed: ${error.message}`, error);

                        return ctx.reply({
                                components: [
                                        this._container(
                                                'Ask failed',
                                                error.message.includes('OPENROUTER_API_KEY')
                                                        ? '`OPENROUTER_API_KEY` is missing in the bot environment.'
                                                        : 'I could not get an answer from OpenRouter right now.',
                                        ),
                                ],
                                flags: MessageFlags.IsComponentsV2,
                        });
                }
        }

        _container(title, body, footer = null) {
                const container = new ContainerBuilder()
                        .setAccentColor(0xffffff)
                        .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(`## ${title}`),
                        )
                        .addSeparatorComponents(
                                new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true),
                        )
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(body));

                if (footer) {
                        container
                                .addSeparatorComponents(
                                        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true),
                                )
                                .addTextDisplayComponents(
                                        new TextDisplayBuilder().setContent(`-# ${footer}`),
                                );
                }

                return container;
        }
}

export default new AskCommand();
