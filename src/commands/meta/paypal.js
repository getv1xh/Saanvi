import { Command } from '#command';
import {
        ActionRowBuilder,
        ButtonBuilder,
        ButtonStyle,
        ContainerBuilder,
        TextDisplayBuilder,
        MessageFlags,
} from 'discord.js';
import { db } from '#dbManager';
import { emoji } from '#emoji';

class PaypalCommand extends Command {
        constructor() {
                super({
                        name: 'paypal',
                        description: 'View your saved PayPal username',
                        cooldown: 5,
                        enabledSlash: true,
                        shouldNotDefer: true,
                        slashData: {
                                name: 'paypal',
                                description: 'View your saved PayPal username',
                        },
                });
        }

        async execute({ ctx }) {
                const username = await db.user.getAddress(ctx.user.id, 'paypal');

                if (!username) {
                        return ctx.reply({
                                components: [this._msgContainer(`**No PayPal username saved. Use \`/setpaypal\` first.**`)],
                                flags: MessageFlags.IsComponentsV2,
                        });
                }

                const customId  = `paypal_qr:${username}`;
                const showButton = customId.length <= 100;

                const components = showButton
                        ? [
                                new ActionRowBuilder().addComponents(
                                        new ButtonBuilder()
                                                .setCustomId(customId)
                                                .setLabel('Generate QR')
                                                .setStyle(ButtonStyle.Secondary),
                                ),
                          ]
                        : [];

                return ctx.reply({
                        content: `\`${username}\``,
                        components,
                });
        }

        _msgContainer(text) {
                return new ContainerBuilder()
                        .setAccentColor(0xffffff)
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
        }
}

export default new PaypalCommand();
