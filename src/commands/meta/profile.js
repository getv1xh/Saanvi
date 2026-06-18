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

const BTN = {
        WALLETS: 'profile:wallets',
        UPI:     'profile:upi',
        BACK:    'profile:back',
};

class ProfileCommand extends Command {
        constructor() {
                super({
                        name: 'profile',
                        description: 'View your saved crypto profile',
                        cooldown: 5,
                        enabledSlash: true,
                        slashData: {
                                name: 'profile',
                                description: 'View your saved crypto profile',
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
                const target     = ctx.options.getUser('user') || ctx.user;
                const isSelf     = target.id === ctx.user.id;
                const addresses  = await db.user.getAllAddresses(target.id);
                const upiId      = addresses?.upi ?? null;

                const walletEntries = Object.entries(addresses || {}).filter(([k]) => k !== 'upi');
                const walletCount   = walletEntries.length;

                const container = this._buildOverview(target, walletCount, upiId, isSelf);
                const row       = this._buildRow(walletCount, upiId);

                await ctx.reply({ components: [container, row], flags: MessageFlags.IsComponentsV2 });
                const msg = await ctx.fetchReply();
                this._startCollector(ctx, msg, target, walletEntries, upiId, isSelf);
        }

        _buildOverview(target, walletCount, upiId, isSelf) {
                const avatarUrl = target.displayAvatarURL({ size: 128, extension: 'png' });
                const joinedTs  = Math.floor(target.createdTimestamp / 1000);

                const headerText =
                        `## ${target.username}\n` +
                        `-# <t:${joinedTs}:D>`;

                const statsText =
                        `${emoji.arrowup} **Wallets**\u2003\`${walletCount} saved\`\n` +
                        `${emoji.upi} **UPI**\u2003\u2003\u2003${upiId ? `\`${upiId}\`` : '-# not set'}`;

                return new ContainerBuilder()
                        .setAccentColor(0xffffff)
                        .addSectionComponents(
                                new SectionBuilder()
                                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(headerText))
                                        .setThumbnailAccessory(new ThumbnailBuilder().setURL(avatarUrl)),
                        )
                        .addSeparatorComponents(
                                new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true),
                        )
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(statsText));
        }

        _buildRow(walletCount, upiId) {
                return new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                                .setCustomId(BTN.WALLETS)
                                .setLabel('Wallets')
                                .setStyle(ButtonStyle.Secondary)
                                .setDisabled(walletCount === 0),
                        new ButtonBuilder()
                                .setCustomId(BTN.UPI)
                                .setLabel('UPI')
                                .setStyle(ButtonStyle.Secondary)
                                .setDisabled(!upiId),
                );
        }

        _buildWalletsView(target, walletEntries) {
                const lines = walletEntries.map(([key, addr]) => {
                        const chain = CHAINS[key];
                        const label = chain ? `${chain.emoji} \`${chain.symbol}\`` : `\`${key.toUpperCase()}\``;
                        return `${label}\n-# \`${addr}\``;
                }).join('\n\n');

                return new ContainerBuilder()
                        .setAccentColor(0xffffff)
                        .addSectionComponents(
                                new SectionBuilder()
                                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                                                `## ${target.username}  ·  Wallets`,
                                        ))
                                        .setThumbnailAccessory(
                                                new ThumbnailBuilder().setURL(target.displayAvatarURL({ size: 128, extension: 'png' })),
                                        ),
                        )
                        .addSeparatorComponents(
                                new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true),
                        )
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines));
        }

        _buildUPIView(target, upiId) {
                return new ContainerBuilder()
                        .setAccentColor(0xffffff)
                        .addSectionComponents(
                                new SectionBuilder()
                                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                                                `## ${target.username}  ·  UPI\n\`\`\`${upiId}\`\`\``,
                                        ))
                                        .setThumbnailAccessory(
                                                new ThumbnailBuilder().setURL(target.displayAvatarURL({ size: 128, extension: 'png' })),
                                        ),
                        );
        }

        _backRow() {
                return new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                                .setCustomId(BTN.BACK)
                                .setLabel('Back')
                                .setStyle(ButtonStyle.Secondary),
                );
        }

        _startCollector(ctx, msg, target, walletEntries, upiId, isSelf) {
                const collector = msg.createMessageComponentCollector({ time: 120_000 });

                collector.on('collect', async (i) => {
                        if (i.user.id !== ctx.user.id) {
                                return i.reply({ content: 'This is not your profile menu.', flags: MessageFlags.Ephemeral });
                        }

                        if (i.customId === BTN.WALLETS) {
                                await i.update({
                                        components: [this._buildWalletsView(target, walletEntries), this._backRow()],
                                        flags: MessageFlags.IsComponentsV2,
                                });
                        } else if (i.customId === BTN.UPI) {
                                await i.update({
                                        components: [this._buildUPIView(target, upiId), this._backRow()],
                                        flags: MessageFlags.IsComponentsV2,
                                });
                        } else if (i.customId === BTN.BACK) {
                                const walletCount = walletEntries.length;
                                await i.update({
                                        components: [
                                                this._buildOverview(target, walletCount, upiId, isSelf),
                                                this._buildRow(walletCount, upiId),
                                        ],
                                        flags: MessageFlags.IsComponentsV2,
                                });
                        }
                });

                collector.on('end', async () => {
                        await disableComponents(msg).catch(() => {});
                });
        }
}

export default new ProfileCommand();
