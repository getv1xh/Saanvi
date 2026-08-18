import { Command } from '#command';
import {
        ApplicationCommandOptionType,
        ContainerBuilder,
        MessageFlags,
        SeparatorBuilder,
        SeparatorSpacingSize,
        TextDisplayBuilder,
} from 'discord.js';
import { calculateOpenRouter, logger } from '#utils';

const payload = (title, body, footer = null) => {
        const container = new ContainerBuilder()
                .setAccentColor(0xffffff)
                .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                                `**${title}**\n${body}`,
                        ),
                );

        if (footer) {
                container
                        .addSeparatorComponents(
                                new SeparatorBuilder()
                                        .setSpacing(SeparatorSpacingSize.Small)
                                        .setDivider(true),
                        )
                        .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                        `-# ${footer}`,
                                ),
                        );
        }

        return {
                components: [container],
                flags: MessageFlags.IsComponentsV2,
                allowedMentions: { parse: [] },
        };
};

const formatDuration = (ms) => {
        if (ms < 1000) return `${ms}ms`;
        return `${(ms / 1000).toFixed(1)}s`;
};

class CalcCommand extends Command {
        constructor() {
                super({
                        name: 'calc',
                        description: 'Quick math or conversion using AI',
                        cooldown: 8,
                        enabledSlash: true,
                        prefix: false,
                        slashData: {
                                name: 'calc',
                                description:
                                        'Quick math or conversion using AI',
                                options: [
                                        {
                                                type: ApplicationCommandOptionType.String,
                                                name: 'input',
                                                description:
                                                        'Example: six plus seven, 6 plus seven minus 9, 10 km to miles',
                                                required: true,
                                                max_length: 300,
                                        },
                                ],
                        },
                });
        }

        async execute({ ctx }) {
                const expression = ctx.options.getString('input', true).trim();

                if (!expression) {
                        return ctx.reply(
                                payload(
                                        'Calc',
                                        'Send math or a conversion for me to solve.',
                                ),
                        );
                }

                const startedAt = Date.now();

                try {
                        const result = await calculateOpenRouter({
                                expression,
                        });

                        return ctx.reply(
                                payload(
                                        'Calc',
                                        `\`${expression.replace(/`/g, "'")}\`\n${result.answer}`,
                                        `calculated in ${formatDuration(Date.now() - startedAt)}`,
                                ),
                        );
                } catch (error) {
                        logger.error(
                                'Calc',
                                `OpenRouter request failed: ${error.message}`,
                                error,
                        );
                        return ctx.reply(
                                payload(
                                        'Calc',
                                        'I could not calculate that right now. Try again in a bit.',
                                ),
                        );
                }
        }
}

export default new CalcCommand();
