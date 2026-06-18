import { Command } from '#command';
import {
        ContainerBuilder,
        TextDisplayBuilder,
        MessageFlags,
        ApplicationCommandOptionType,
} from 'discord.js';
import { db } from '#dbManager';
import { emoji } from '#emoji';

const PAYPAL_REGEX = /^@?[a-zA-Z0-9._-]{3,20}$/;

class SetPaypalCommand extends Command {
        constructor() {
                super({
                        name: 'setpaypal',
                        description: 'Save your PayPal username',
                        cooldown: 5,
                        enabledSlash: true,
                        slashData: {
                                name: 'setpaypal',
                                description: 'Save your PayPal username',
                                options: [
                                        {
                                                type: ApplicationCommandOptionType.String,
                                                name: 'username',
                                                description: 'Your PayPal username (e.g. @Ishika870)',
                                                required: true,
                                        },
                                ],
                        },
                });
        }

        async execute({ ctx }) {
                let username = ctx.options.getString('username').trim();

                if (!PAYPAL_REGEX.test(username)) {
                        return ctx.reply({
                                components: [this._msgContainer(`**That doesn't look like a valid PayPal username.**\n-# Expected format: \`@YourName\``)],
                                flags: MessageFlags.IsComponentsV2,
                        });
                }

                if (!username.startsWith('@')) username = `@${username}`;

                await db.user.setAddress(ctx.user.id, 'paypal', username);

                const container = new ContainerBuilder()
                        .setAccentColor(0xffffff)
                        .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                        `## ${emoji.paypal}  PayPal\n-# Username saved\n\`\`\`${username}\`\`\``,
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
