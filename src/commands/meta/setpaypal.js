import { Command } from '#command';
import {
        ContainerBuilder,
        TextDisplayBuilder,
        MessageFlags,
        ApplicationCommandOptionType,
} from 'discord.js';
import { db } from '#dbManager';
import { emoji } from '#emoji';

const PAYPAL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

class SetPaypalCommand extends Command {
        constructor() {
                super({
                        name: 'setpaypal',
                        description: 'Save your PayPal email address',
                        cooldown: 5,
                        enabledSlash: true,
                        slashData: {
                                name: 'setpaypal',
                                description: 'Save your PayPal email address',
                                options: [
                                        {
                                                type: ApplicationCommandOptionType.String,
                                                name: 'email',
                                                description: 'Your PayPal email (e.g. name@example.com)',
                                                required: true,
                                        },
                                ],
                        },
                });
        }

        async execute({ ctx }) {
                const email = ctx.options.getString('email').trim().toLowerCase();

                if (!PAYPAL_REGEX.test(email)) {
                        return ctx.reply({
                                components: [this._msgContainer(`**That doesn't look like a valid email address.**\n-# Expected format: \`name@example.com\``)],
                                flags: MessageFlags.IsComponentsV2,
                        });
                }

                await db.user.setAddress(ctx.user.id, 'paypal', email);

                const container = new ContainerBuilder()
                        .setAccentColor(0xffffff)
                        .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                        `## ${emoji.paypal}  PayPal\n-# Email saved\n\`\`\`${email}\`\`\``,
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

export default new SetPaypalCommand();
