import { Command } from '#command';
import {
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

                const container = new ContainerBuilder()
                        .setAccentColor(0xffffff)
                        .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                        `## ${emoji.paypal}  PayPal\n\`\`\`${username}\`\`\``,
                                ),
                        );

                return ctx.reply({
                        components: [container],
                        flags: MessageFlags.IsComponentsV2,
                });
        }

        _msgContainer(text) {
                return new ContainerBuilder()
                        .setAccentColor(0xffffff)
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
        }
}

export default new PaypalCommand();
