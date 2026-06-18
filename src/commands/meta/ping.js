import { Command } from '#command';
import {
        ContainerBuilder,
        TextDisplayBuilder,
        MessageFlags,
} from 'discord.js';
import { client } from '#src/bot';
import mongoose from 'mongoose';

class PingCommand extends Command {
        constructor() {
                super({
                        name: 'ping',
                        description: 'Check bot latency',
                        cooldown: 5,
                        enabledSlash: true,
                        slashData: {
                                name: 'ping',
                                description: 'Check bot latency',
                        },
                });
        }

        async execute({ ctx }) {
                const dbStart = Date.now();
                await mongoose.connection.db.admin().command({ ping: 1 });
                const dbPing = Date.now() - dbStart;

                const wsPing = Math.round(client.ws.ping);
                const avg    = Math.round((wsPing + dbPing) / 2);

                const pad = (label) => label.padEnd(17);

                const ansi =
                        `\`\`\`ansi\n` +
                        `\u001b[1;35mLatency\u001b[0m\n` +
                        `\u001b[1;36m${pad('Websocket')}:: ${wsPing} MS\u001b[0m\n` +
                        `\u001b[1;36m${pad('Database')}:: ${dbPing} MS\u001b[0m\n` +
                        `\u001b[1;36m${pad('Average Latency')}:: ${avg} MS\u001b[0m\n` +
                        `\`\`\``;

                const container = new ContainerBuilder()
                        .setAccentColor(0xffffff)
                        .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(ansi),
                        );

                await ctx.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
        }
}

export default new PingCommand();
