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

const BTN = {
        WALLETS: 'profile:wallets',
        UPI:     'profile:upi',
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
                const upiId         = addresses?.upi ?? null;
                const walletEntries = Object.entries(addresses || {}).filter(([k]) => k !== 'upi');

                const container = this._buildOverview(target, walletEntries, upiId);

                await ctx.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
                const msg = await ctx.fetchReply();
                this._startCollector(ctx, msg, target, walletEntries, upiId);
        }

        _buildOverview(target, walletEntries, upiId) {
                const avatarUrl  = target.displayAvatarURL({ size: 256, extension: 'png' });
                const sinceTs    = Math.floor(target.createdTimestamp / 1000);
                const walletCount = walletEntries.length;

                // Chain names preview e.g. "Bitcoin · Ethereum · Solana · +2 more"
                const SHOW = 3;
                const chainNames = walletEntries.map(([k]) => CHAINS[k]?.name ?? k.toUpperCase());
                const walletPreview = walletCount === 0
                        ? '-# no wallets saved'
                        : '> ' + chainNames.slice(0, SHOW).join(' · ') +
                          (walletCount > SHOW ? ` · +${walletCount - SHOW} more` : '');

                const upiLine = upiId
                        ? `> ${upiId}`
                        : '-# not configured';

                const body =
                        `**Wallets**  ·  ${walletCount} saved\n${walletPreview}\n\n` +
                        `**UPI**\n${upiLine}`;

                const container = new ContainerBuilder()
                        .setAccentColor(0xffffff)
                        .addSectionComponents(
                                new SectionBuilder()
                                        .addTextDisplayComponents(
                                                new TextDisplayBuilder().setContent(
                                                        `## ${target.username}\n-# Crypto Profile  ·  Since <t:${sinceTs}:D>`,
                                                ),
                                        )
                                        .setThumbnailAccessory(new ThumbnailBuilder().setURL(avatarUrl)),
                        )
                        .addSeparatorComponents(
                                new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true),
                        )
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(body))
                        .addSeparatorComponents(
                                new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true),
                        )
                        .addActionRowComponents(
                                new ActionRowBuilder().addComponents(
                                        new ButtonBuilder()
                                                .setCustomId(BTN.WALLETS)
                                                .setLabel('View Wallets')
                                                .setStyle(ButtonStyle.Secondary)
                                                .setDisabled(walletCount === 0),
                                        new ButtonBuilder()
                                                .setCustomId(BTN.UPI)
                                                .setLabel('View UPI')
                                                .setStyle(ButtonStyle.Secondary)
                                                .setDisabled(!upiId),
                                ),
                        );

                return container;
        }

        _buildWalletsContainer(target, walletEntries) {
                const avatarUrl = target.displayAvatarURL({ size: 256, extension: 'png' });

                const lines = walletEntries.map(([key, addr]) => {
                        const chain = CHAINS[key];
                        const label = chain
                                ? `**${chain.name}** \`${chain.symbol}\``
                                : `**${key.toUpperCase()}**`;
                        return `${label}\n> \`${addr}\``;
                }).join('\n\n');

                return new ContainerBuilder()
                        .setAccentColor(0xffffff)
                        .addSectionComponents(
                                new SectionBuilder()
                                        .addTextDisplayComponents(
                                                new TextDisplayBuilder().setContent(
                                                        `## ${target.username}  ·  Wallets\n-# ${walletEntries.length} address${walletEntries.length !== 1 ? 'es' : ''} saved`,
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
                                                        `## ${target.username}  ·  UPI`,
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

        _startCollector(ctx, msg, target, walletEntries, upiId) {
                const collector = msg.createMessageComponentCollector({ time: 120_000 });

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
                        }
                });

                collector.on('end', async () => {
                        await disableComponents(msg).catch(() => {});
                });
        }
}

export default new ProfileCommand();
