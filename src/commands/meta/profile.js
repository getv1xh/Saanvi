import { Command } from '#command';
import {
        ContainerBuilder,
        SectionBuilder,
        ThumbnailBuilder,
        TextDisplayBuilder,
        SeparatorBuilder,
        SeparatorSpacingSize,
        ActionRowBuilder,
        ButtonBuilder,
        ButtonStyle,
        MessageFlags,
        ApplicationCommandOptionType,
} from 'discord.js';
import { db } from '#dbManager';
import { CHAINS, disableComponents } from '#utils';
import { emoji } from '#emoji';
import { client } from '#src/bot';

const BTN = {
        WALLETS: 'profile:wallets',
        UPI:     'profile:upi',
        PAYPAL:  'profile:paypal',
};

class ProfileCommand extends Command {
        constructor() {
                super({
                        name: 'profile',
                        description: 'View a crypto profile — saved wallets and UPI',
                        cooldown: 5,
                        enabledSlash: true,
                        slashData: {
                                name: 'profile',
                                description: 'View a crypto profile — saved wallets and UPI',
                                options: [
                                        {
                                                type: ApplicationCommandOptionType.User,
                                                name: 'user',
                                                description: 'User to view (defaults to you)',
                                                required: false,
                                        },
                                ],
                        },
                });
        }

        async execute({ ctx }) {
                const target        = ctx.options.getUser('user') || ctx.user;
                const addresses     = await db.user.getAllAddresses(target.id);
                const upiId         = addresses?.upi    ?? null;
                const paypalId      = addresses?.paypal ?? null;
                const walletEntries = Object.entries(addresses || {}).filter(([k]) => k !== 'upi' && k !== 'paypal');

                const container = this._buildProfile(target, walletEntries, upiId, paypalId);

                await ctx.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
                const msg = await ctx.fetchReply();
                this._startCollector(ctx, msg, target, walletEntries, upiId, paypalId);
        }

        _buildProfile(target, walletEntries, upiId, paypalId) {
                const sinceTs     = Math.floor(target.createdTimestamp / 1000);
                const walletCount = walletEntries.length;
                const botName     = client.user?.username ?? 'Bot';

                const userInfo =
                        `> -# ${emoji.p_id} **ID** \`${target.id}\`\n` +
                        `> -# ${emoji.p_mention} **Mention** <@${target.id}>\n` +
                        `> -# ${emoji.p_join} **Account Created** <t:${sinceTs}:D>`;

                const savedInfo =
                        `> -# ${emoji.p_counts} **Wallets Saved** \`${walletCount}\`\n` +
                        `> -# ${emoji.money} **UPI** ${upiId ? `\`${upiId}\`` : '`not set`'}\n` +
                        `> -# ${emoji.paypal} **PayPal** ${paypalId ? `\`${paypalId}\`` : '`not set`'}`;

                const container = new ContainerBuilder()
                        .setAccentColor(0xffffff)
                        .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(`## ${target.username}'s Profile`),
                        )
                        .addSeparatorComponents(
                                new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true),
                        )
                        .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(`### __User Info__\n${userInfo}`),
                        )
                        .addSeparatorComponents(
                                new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true),
                        )
                        .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(`### __Saved__\n${savedInfo}`),
                        )
                        .addSeparatorComponents(
                                new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true),
                        )
                        .addActionRowComponents(
                                new ActionRowBuilder().addComponents(
                                        new ButtonBuilder()
                                                .setCustomId(BTN.WALLETS)
                                                .setLabel('Crypto Wallets')
                                                .setStyle(ButtonStyle.Secondary)
                                                .setDisabled(walletCount === 0),
                                        new ButtonBuilder()
                                                .setCustomId(BTN.UPI)
                                                .setLabel('UPI')
                                                .setStyle(ButtonStyle.Secondary)
                                                .setDisabled(!upiId),
                                        new ButtonBuilder()
                                                .setCustomId(BTN.PAYPAL)
                                                .setLabel('PayPal')
                                                .setStyle(ButtonStyle.Secondary)
                                                .setDisabled(!paypalId),
                                ),
                        );

                container
                        .addSeparatorComponents(
                                new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true),
                        )
                        .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                        `-# ${emoji.botlogo} All rights reserved by ${botName}`,
                                ),
                        );

                return container;
        }

        _buildWalletsContainer(target, walletEntries) {
                const avatarUrl = target.displayAvatarURL({ size: 256, extension: 'png' });

                const lines = walletEntries.map(([key, addr]) => {
                        const chain = CHAINS[key];
                        const label = chain ? `**${chain.name}** \`${chain.symbol}\`` : `**${key.toUpperCase()}**`;
                        return `${label}\n> \`${addr}\``;
                }).join('\n\n');

                return new ContainerBuilder()
                        .setAccentColor(0xffffff)
                        .addSectionComponents(
                                new SectionBuilder()
                                        .addTextDisplayComponents(
                                                new TextDisplayBuilder().setContent(
                                                        `## ${target.username}'s Profile\n### __Crypto Wallets__\n-# ${walletEntries.length} address${walletEntries.length !== 1 ? 'es' : ''} saved`,
                                                ),
                                        )
                                        .setThumbnailAccessory(new ThumbnailBuilder().setURL(avatarUrl)),
                        )
                        .addSeparatorComponents(
                                new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true),
                        )
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines));
        }

        _buildUPIContainer(target, upiId) {
                const avatarUrl = target.displayAvatarURL({ size: 256, extension: 'png' });

                return new ContainerBuilder()
                        .setAccentColor(0xffffff)
                        .addSectionComponents(
                                new SectionBuilder()
                                        .addTextDisplayComponents(
                                                new TextDisplayBuilder().setContent(
                                                        `## ${target.username}'s Profile\n### __UPI__`,
                                                ),
                                        )
                                        .setThumbnailAccessory(new ThumbnailBuilder().setURL(avatarUrl)),
                        )
                        .addSeparatorComponents(
                                new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true),
                        )
                        .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(`> \`${upiId}\``),
                        );
        }

        _buildPaypalContainer(target, paypalId) {
                return new ContainerBuilder()
                        .setAccentColor(0xffffff)
                        .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                        `## ${target.username}'s Profile\n### __PayPal__`,
                                ),
                        )
                        .addSeparatorComponents(
                                new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true),
                        )
                        .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(`> \`${paypalId}\``),
                        );
        }

        _startCollector(ctx, msg, target, walletEntries, upiId, paypalId) {
                const collector = msg.createMessageComponentCollector({ idle: 120_000 });

                collector.on('collect', async (i) => {
                        if (i.user.id !== ctx.user.id) {
                                return i.reply({
                                        content: 'This menu belongs to someone else.',
                                        flags: MessageFlags.Ephemeral,
                                });
                        }

                        if (i.customId === BTN.WALLETS) {
                                await i.reply({
                                        components: [this._buildWalletsContainer(target, walletEntries)],
                                        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
                                });
                        } else if (i.customId === BTN.UPI) {
                                await i.reply({
                                        components: [this._buildUPIContainer(target, upiId)],
                                        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
                                });
                        } else if (i.customId === BTN.PAYPAL) {
                                await i.reply({
                                        components: [this._buildPaypalContainer(target, paypalId)],
                                        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
                                });
                        }
                });

                collector.on('end', async () => {
                        await disableComponents(msg).catch(() => {});
                });
        }
}

export default new ProfileCommand();
