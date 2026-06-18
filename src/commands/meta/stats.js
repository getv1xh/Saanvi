import { Command } from '#command';
import {
        ContainerBuilder,
        SectionBuilder,
        ThumbnailBuilder,
        TextDisplayBuilder,
        SeparatorBuilder,
        SeparatorSpacingSize,
        MessageFlags,
} from 'discord.js';
import { client } from '#src/bot';

function formatUptime(ms) {
        const s = Math.floor(ms / 1000);
        const d = Math.floor(s / 86400);
        const h = Math.floor((s % 86400) / 3600);
        const m = Math.floor((s % 3600) / 60);
        const parts = [];
        if (d) parts.push(`${d}d`);
        if (h) parts.push(`${h}h`);
        if (m) parts.push(`${m}m`);
        return parts.join(' ') || '< 1m';
}

function fmt(n) {
        return n.toLocaleString('en-US');
}

class StatsCommand extends Command {
        constructor() {
                super({
                        name: 'stats',
                        description: 'View bot statistics',
                        cooldown: 5,
                        enabledSlash: true,
                        slashData: {
                                name: 'stats',
                                description: 'View bot statistics',
                        },
                });
        }

        async execute({ ctx }) {
                const servers  = client.guilds.cache.size;
                const users    = client.guilds.cache.reduce((a, g) => a + g.memberCount, 0);
                const commands = client.commandHandler?.slashCommands?.size ?? 0;
                const uptime   = formatUptime(client.uptime ?? 0);
                const avatar   = client.user.displayAvatarURL({ size: 256 });

                const info =
                        `> **Commands:** \`${commands}\`\n` +
                        `> **Uptime:** \`${uptime}\`\n` +
                        `> **Users:** \`${fmt(users)}\`\n` +
                        `> **Servers:** \`${fmt(servers)}\``;

                const container = new ContainerBuilder()
                        .setAccentColor(0xffffff)
                        .addSectionComponents(
                                new SectionBuilder()
                                        .addTextDisplayComponents(
                                                new TextDisplayBuilder().setContent(`## ${client.user.username}`),
                                        )
                                        .setThumbnailAccessory(
                                                new ThumbnailBuilder().setURL(avatar),
                                        ),
                        )
                        .addSeparatorComponents(
                                new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true),
                        )
                        .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(`### Bot Info\n${info}`),
                        );

                await ctx.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
        }
}

export default new StatsCommand();
