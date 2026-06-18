import { Command } from '#command';
import {
        ContainerBuilder,
        TextDisplayBuilder,
        MessageFlags,
} from 'discord.js';
import { db } from '#dbManager';
import { emoji } from '#emoji';

class RemovePaypalCommand extends Command {
        constructor() {
                super({
                        name: 'removepaypal',
                        description: 'Remove your saved PayPal email address',
                        cooldown: 5,
                        enabledSlash: true,
                        slashData: {
                                name: 'removepaypal',
                                description: 'Remove your saved PayPal email address',
                        },
                });
        }

        async execute({ ctx }) {
                const existing = await db.user.getAddress(ctx.user.id, 'paypal');

                if (!existing) {
                        return ctx.reply({
                                components: [this._msgContainer(`**No PayPal email saved to remove.**`)],
                                flags: MessageFlags.IsComponentsV2,
                        });
                }

                await db.user.removeAddress(ctx.user.id, 'paypal');

                const container = new ContainerBuilder()
                        .setAccentColor(0xffffff)
                        .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                        `## ${emoji.paypal}  PayPal\n-# Email removed\n\`\`\`${existing}\`\`\``,
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

export default new RemovePaypalCommand();
