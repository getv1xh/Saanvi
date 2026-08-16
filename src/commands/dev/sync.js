import { Routes } from 'discord-api-types/v10';
import { Command } from '#command';
import { logger } from '#utils';

const snowflakeRegex = /^\d{17,20}$/;

const toGuildCommandData = (commands) =>
        commands.map(({ integration_types, contexts, ...command }) => command);

class SyncCommand extends Command {
        constructor() {
                super({
                        name: 'sync',
                        description: 'Sync slash commands to a guild',
                        usage: 'sync [guildId]',
                        category: 'developer',
                        ownerOnly: true,
                        enabledSlash: false,
                        prefix: true,
                        cooldown: 10,
                });
        }

        async execute({ ctx }) {
                const guildId = ctx.args[0] || ctx.guild?.id;

                if (!guildId || !snowflakeRegex.test(guildId)) {
                        return ctx.reply('Sync failed. Use `.sync` in a server or `.sync <guildId>`.');
                }

                const slashData = toGuildCommandData(ctx.client.commandHandler.getSlashCommandsData());

                if (slashData.length === 0) {
                        return ctx.reply('Sync failed. No slash commands found to register.');
                }

                try {
                        logger.info('Sync', `Slash command sync requested by ${ctx.user.id} for guild ${guildId}`);

                        await ctx.client.rest.put(
                                Routes.applicationGuildCommands(ctx.client.user.id, guildId),
                                { body: slashData },
                        );

                        return ctx.reply(
                                `<:Heart_Red:1538521542798082060> **DONE.** __**Synced ${slashData.length} slash command(s) to this guild.**__`,
                        );
                } catch (error) {
                        logger.error('Sync', `Guild slash command sync failed for ${guildId}: ${error.message}`, error);
                        return ctx.reply(`Sync failed. ${error.message}`);
                }
        }
}

export default new SyncCommand();
