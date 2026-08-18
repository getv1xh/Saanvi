import { Command } from '#command';
import {
        ApplicationCommandOptionType,
        ContainerBuilder,
        MessageFlags,
        SeparatorBuilder,
        SeparatorSpacingSize,
        TextDisplayBuilder,
} from 'discord.js';

const STYLES = [
        { name: 'Short date/time', value: 'f' },
        { name: 'Relative time', value: 'R' },
        { name: 'Long date/time', value: 'F' },
        { name: 'Short time', value: 't' },
        { name: 'Long time', value: 'T' },
        { name: 'Short date', value: 'd' },
        { name: 'Long date', value: 'D' },
];

const extractUnix = (input) => {
        const timestampMatch = input.match(/^<t:(-?\d{1,13})(?::[tTdDfFR])?>$/);
        if (timestampMatch) return Number(timestampMatch[1]);

        if (/^-?\d{1,13}$/.test(input)) {
                const numeric = Number(input);
                if (Math.abs(numeric) >= 10_000_000_000) {
                        return Math.floor(numeric / 1000);
                }
                return numeric;
        }

        return null;
};

const parseTimeInput = (input) => {
        const text = String(input || '').trim();
        if (!text) return null;
        if (/^now$/i.test(text)) return Math.floor(Date.now() / 1000);

        const unix = extractUnix(text);
        if (Number.isFinite(unix)) return unix;

        const parsed = Date.parse(text);
        if (!Number.isNaN(parsed)) return Math.floor(parsed / 1000);

        return null;
};

const payload = (body) => {
        const container = new ContainerBuilder()
                .setAccentColor(0xffffff)
                .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(body),
                );

        return {
                components: [container],
                flags: MessageFlags.IsComponentsV2,
                allowedMentions: { parse: [] },
        };
};

const resultPayload = (unix, style) => {
        const selected = `<t:${unix}:${style}>`;
        const examples = STYLES.map(
                ({ name, value }) => {
                        const markdown = `<t:${unix}:${value}>`;
                        return `**${name}** \`${markdown}\` ${markdown}`;
                },
        ).join('\n');
        const container = new ContainerBuilder()
                .setAccentColor(0xffffff)
                .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                                `**Timestamp**\n\`${selected}\`\n${selected}`,
                        ),
                )
                .addSeparatorComponents(
                        new SeparatorBuilder()
                                .setSpacing(SeparatorSpacingSize.Small)
                                .setDivider(true),
                )
                .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                                `**Unix** \`${unix}\`\n\n${examples}`,
                        ),
                );

        return {
                components: [container],
                flags: MessageFlags.IsComponentsV2,
                allowedMentions: { parse: [] },
        };
};

class TimestampCommand extends Command {
        constructor() {
                super({
                        name: 'timestamp',
                        description: 'Create Discord timestamp markdown',
                        cooldown: 5,
                        enabledSlash: true,
                        prefix: false,
                        slashData: {
                                name: 'timestamp',
                                description:
                                        'Create Discord timestamp markdown',
                                options: [
                                        {
                                                type: ApplicationCommandOptionType.String,
                                                name: 'time',
                                                description:
                                                        'Unix seconds/ms, ISO date, or now',
                                                required: true,
                                                max_length: 120,
                                        },
                                        {
                                                type: ApplicationCommandOptionType.String,
                                                name: 'style',
                                                description:
                                                        'Discord timestamp display style',
                                                required: false,
                                                choices: STYLES,
                                        },
                                ],
                        },
                });
        }

        async execute({ ctx }) {
                const input = ctx.options.getString('time', true);
                const style = ctx.options.getString('style') || 'f';
                const unix = parseTimeInput(input);

                if (!Number.isFinite(unix)) {
                        return ctx.reply(
                                payload(
                                        '**Timestamp**\nI could not read that time. Try `now`, `1787049000`, or `2026-08-18T15:30:00+05:30`.',
                                ),
                        );
                }

                return ctx.reply(resultPayload(unix, style));
        }
}

export default new TimestampCommand();
