import { Routes } from 'discord-api-types/v10';
import { Command } from '#command';
import { logger } from '#utils';

const snowflakeRegex = /^\d{17,20}$/;

const pickGuildId = (ctx, value) => {
        if (value && snowflakeRegex.test(value)) return value;
        return ctx.guild?.id || null;
};

class SyncCommand extends Command {
        constructor() {
                super({
                        name: 'sync',
                        description: 'Sync slash commands to a guild',
                        usage: 'sync [guildId|global|clear|clear-global]',
                        category: 'developer',
                        ownerOnly: true,
                        enabledSlash: false,
                        prefix: true,
                        cooldown: 10,
                });
        }

        async execute({ ctx }) {
                const action = ctx.args[0]?.toLowerCase() || 'guild';
                const slashData = ctx.client.commandHandler.getSlashCommandsData();
                const guildData = ctx.client.commandHandler.getGuildSlashCommandsData();

                if (slashData.length === 0) {
                        return ctx.reply('Sync failed. No slash commands found to register.');
                }

                try {
                        if (action === 'global') {
                                await ctx.client.rest.put(
                                        Routes.applicationCommands(ctx.client.user.id),
                                        { body: slashData },
                                );

                                const guildId = pickGuildId(ctx, ctx.args[1]);
                                if (guildId) {
                                        await ctx.client.rest.put(
                                                Routes.applicationGuildCommands(ctx.client.user.id, guildId),
                                                { body: [] },
                                        );
                                }

                                logger.info('Sync', `Global slash command sync requested by ${ctx.user.id}`);
                                return ctx.reply(
                                        `<:Heart_Red:1538521542798082060> **DONE.** __**Synced ${slashData.length} slash command(s) globally.**__`,
                                );
                        }

                        if (action === 'clear' || action === 'clear-guild') {
                                const guildId = pickGuildId(ctx, ctx.args[1]);
                                if (!guildId) return ctx.reply('Sync failed. Use `.sync clear` in a server or `.sync clear <guildId>`.');

                                await ctx.client.rest.put(
                                        Routes.applicationGuildCommands(ctx.client.user.id, guildId),
                                        { body: [] },
                                );

                                logger.info('Sync', `Cleared guild slash commands in ${guildId} by ${ctx.user.id}`);
                                return ctx.reply('<:Heart_Red:1538521542798082060> **DONE.** __**Cleared guild slash commands.**__');
                        }

                        if (action === 'clear-global') {
                                await ctx.client.rest.put(Routes.applicationCommands(ctx.client.user.id), { body: [] });

                                logger.info('Sync', `Cleared global slash commands by ${ctx.user.id}`);
                                return ctx.reply('<:Heart_Red:1538521542798082060> **DONE.** __**Cleared global slash commands.**__');
                        }

                        const guildId = pickGuildId(ctx, action === 'guild' ? ctx.args[1] : ctx.args[0]);

                        if (!guildId) {
                                return ctx.reply('Sync failed. Use `.sync` in a server or `.sync <guildId>`.');
                        }

                        await ctx.client.rest.put(
                                Routes.applicationGuildCommands(ctx.client.user.id, guildId),
                                { body: guildData },
                        );

                        logger.info('Sync', `Guild slash command sync requested by ${ctx.user.id} for guild ${guildId}`);
                        return ctx.reply(
                                `<:Heart_Red:1538521542798082060> **DONE.** __**Synced ${guildData.length} slash command(s) to this guild. Global commands were left intact.**__`,
                        );
                } catch (error) {
                        logger.error('Sync', `Slash command sync failed: ${error.message}`, error);
                        return ctx.reply(`Sync failed. ${error.message}`);
                }
        }
}

export default new SyncCommand();
