import { consumePullRestartState, logger } from '#utils';
import { Routes } from 'discord-api-types/v10';
import { config } from '#config';

const sendPullRestartConfirmation = async (client) => {
        let state = null;

        try {
                state = await consumePullRestartState();
        } catch (error) {
                logger.error('Pull', 'Failed to read pull restart state', error);
                return;
        }

        if (!state) return;

        try {
                const channel = await client.channels.fetch(state.channelId);
                if (!channel?.isTextBased?.()) return;

                await channel.send('<:Heart_Red:1538521542798082060> **DONE.** __**Code pulled and PM2 restarted.**__');
                logger.success('Pull', `Restart confirmation sent to ${state.channelId}`);
        } catch (error) {
                logger.error('Pull', 'Failed to send restart confirmation', error);
        }
};

export default {
        name: 'clientReady',
        once: true,
        async execute({ client }) {
                logger.success('Bot', `Logged in as ${client.user.tag}`);

                const presences = config.presences;
                let index = Math.floor(Math.random() * presences.length);

                const applyPresence = () => {
                        const p = presences[index];
                        client.user.setPresence({
                                status: p.status,
                                activities: [p.activity],
                        });
                        index = (index + 1) % presences.length;
                };

                applyPresence();
                setInterval(applyPresence, 45_000);

                logger.info('Bot', `Serving ${client.guilds.cache.size} guilds`);
                await sendPullRestartConfirmation(client);

                const slashData = client.commandHandler.getSlashCommandsData();

                if (slashData.length > 0) {
                        try {
                                if (config.slashCommands.scope === 'guild' && config.slashCommands.guildId) {
                                        const guildData = client.commandHandler.getGuildSlashCommandsData();

                                        await client.rest.put(
                                                Routes.applicationGuildCommands(client.user.id, config.slashCommands.guildId),
                                                { body: guildData },
                                        );
                                        await client.rest.put(Routes.applicationCommands(client.user.id), { body: [] });

                                        logger.success(
                                                'Bot',
                                                `Registered ${guildData.length} slash command(s) to guild ${config.slashCommands.guildId}.`,
                                        );
                                } else {
                                        await client.rest.put(Routes.applicationCommands(client.user.id), {
                                                body: slashData,
                                        });
                                        logger.success('Bot', `Registered ${slashData.length} slash command(s) globally.`);
                                }
                        } catch (error) {
                                logger.error('Bot', 'Failed to register slash commands', error);
                        }
                } else {
                        logger.info('Bot', 'No slash commands to register.');
                }
        },
};
