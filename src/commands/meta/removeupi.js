import { Command } from '#command';
import {
        ContainerBuilder,
        TextDisplayBuilder,
        MessageFlags,
} from 'discord.js';
import { db } from '#dbManager';
import { emoji } from '#emoji';

class RemoveUpiCommand extends Command {
        constructor() {
                super({
                        name: 'removeupi',
                        description: 'Remove your saved UPI ID',
                        cooldown: 5,
                        enabledSlash: true,
                        slashData: {
                                name: 'removeupi',
                                description: 'Remove your saved UPI ID',
                        },
                });
        }

        async execute({ ctx }) {
                const existing = await db.user.getAddress(ctx.user.id, 'upi');

                if (!existing) {
                        return ctx.reply({
                                components: [this._msgContainer(`**No UPI ID saved to remove.**`)],
                                flags: MessageFlags.IsComponentsV2,
                        });
                }

                await db.user.removeAddress(ctx.user.id, 'upi');

                const container = new ContainerBuilder()
                        .setAccentColor(0xffffff)
                        .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                        `## ${emoji.upi}\n-# ID removed\n\`\`\`${existing}\`\`\``,
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

export default new RemoveUpiCommand();
