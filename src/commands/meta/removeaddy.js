import { Command } from '#command';
import {
        ContainerBuilder,
        TextDisplayBuilder,
        MessageFlags,
        ApplicationCommandOptionType,
} from 'discord.js';
import { resolveChain, CHAINS } from '#utils';
import { db } from '#dbManager';

const FEATURED = ['btc', 'eth', 'ltc', 'sol', 'trx', 'xrp'];

const ALL_CHOICES = Object.entries(CHAINS).map(([key, chain]) => ({
        name: `${chain.name} (${chain.symbol})`,
        value: key,
}));

const FEATURED_CHOICES = FEATURED.map(key => ({
        name: `${CHAINS[key].name} (${CHAINS[key].symbol})`,
        value: key,
}));

class RemoveAddyCommand extends Command {
        constructor() {
                super({
                        name: 'removeaddy',
                        description: 'Remove a saved wallet address for a chain',
                        cooldown: 5,
                        enabledSlash: true,
                        slashData: {
                                name: 'removeaddy',
                                description: 'Remove a saved wallet address for a chain',
                                options: [
                                        {
                                                type: ApplicationCommandOptionType.String,
                                                name: 'crypto',
                                                description: 'Chain to remove the address for',
                                                required: true,
                                                autocomplete: true,
                                        },
                                ],
                        },
                });
        }

        async autocomplete({ interaction }) {
                const focused = interaction.options.getFocused().toLowerCase().trim();

                const matches = focused
                        ? ALL_CHOICES.filter(c =>
                                c.name.toLowerCase().includes(focused) ||
                                c.value.toLowerCase().includes(focused),
                          ).slice(0, 25)
                        : FEATURED_CHOICES;

                await interaction.respond(matches);
        }

        async execute({ ctx }) {
                const chainInput = ctx.options.getString('crypto');

                const chainCfg = resolveChain(chainInput);
                if (!chainCfg) {
                        return ctx.reply({
                                components: [this._msgContainer(`**\`${chainInput}\` is not a recognised coin.**`)],
                                flags: MessageFlags.IsComponentsV2,
                        });
                }

                const existing = await db.user.getAddress(ctx.user.id, chainCfg.key);
                if (!existing) {
                        return ctx.reply({
                                components: [this._msgContainer(`**No \`${chainCfg.symbol}\` address saved to remove.**`)],
                                flags: MessageFlags.IsComponentsV2,
                        });
                }

                await db.user.removeAddress(ctx.user.id, chainCfg.key);

                const container = new ContainerBuilder()
                        .setAccentColor(0xffffff)
                        .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                        `## ${chainCfg.emoji}  ${chainCfg.name}  \`${chainCfg.symbol}\`\n` +
                                        `-# Address removed\n\`\`\`${existing}\`\`\``,
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

export default new RemoveAddyCommand();
