import { Command } from '#command';
import {
        ContainerBuilder,
        TextDisplayBuilder,
        SeparatorBuilder,
        SeparatorSpacingSize,
        ActionRowBuilder,
        ButtonBuilder,
        ButtonStyle,
        MediaGalleryBuilder,
        MediaGalleryItemBuilder,
        AttachmentBuilder,
        ModalBuilder,
        TextInputBuilder,
        TextInputStyle,
        MessageFlags,
} from 'discord.js';
import { disableComponents } from '#utils';
import { emoji } from '#emoji';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BANNER = path.join(__dirname, '../../assets', 'help_banner.png');

let _cmdMapCache = null;
async function getCmdMap(client) {
        if (_cmdMapCache) return _cmdMapCache;
        try {
                const registered = await client.application.commands.fetch();
                _cmdMapCache = {};
                registered.forEach(cmd => { _cmdMapCache[cmd.name] = cmd.id; });
        } catch {
                _cmdMapCache = {};
        }
        return _cmdMapCache;
}

const PAGES = [
        {
                title: '### Wallet',
                commands: ['setaddy', 'addy', 'removeaddy', 'bal', 'mybal'],
                descriptions: {
                        setaddy:    'save an address for a chain',
                        addy:       'show a saved address with a QR button',
                        removeaddy: 'remove a saved wallet address',
                        bal:        'look up any wallet by address',
                        mybal:      'detailed view of your saved wallet',
                },
        },
        {
                title: '### UPI',
                commands: ['setupi', 'upi', 'removeupi'],
                descriptions: {
                        setupi:    'save your UPI ID',
                        upi:       'show your saved UPI ID with a QR button',
                        removeupi: 'remove your saved UPI ID',
                },
        },
        {
                title: '### PayPal',
                commands: ['setpaypal', 'paypal', 'removepaypal'],
                descriptions: {
                        setpaypal:    'save your PayPal username',
                        paypal:       'show your saved PayPal username with a QR button',
                        removepaypal: 'remove your saved PayPal username',
                },
        },
        {
                title: '### Market & Profile',
                commands: ['price', 'tx', 'profile'],
                descriptions: {
                        price:   'live price and 24h change',
                        tx:      'transaction lookup, chain auto detected',
                        profile: 'view wallets, UPI and PayPal saved by any user',
                },
        },
        {
                title: '### Utility',
                commands: ['ping', 'stats'],
                descriptions: {
                        ping:  'check websocket, database and average latency',
                        stats: 'view bot uptime, servers, users and command count',
                },
        },
];

const TOTAL = PAGES.length;

function parseEmoji(str) {
        const m = str.match(/<:(\w+):(\d+)>/);
        return m ? { name: m[1], id: m[2] } : { name: str };
}

function buildNavRow(page, userId) {
        return new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                        .setCustomId(`help:prev:${page}:${userId}`)
                        .setEmoji(parseEmoji(emoji.pg_prev))
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(page <= 1),
                new ButtonBuilder()
                        .setCustomId(`help:label:${page}`)
                        .setLabel(`${page} / ${TOTAL}`)
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true),
                new ButtonBuilder()
                        .setCustomId(`help:next:${page}:${userId}`)
                        .setEmoji(parseEmoji(emoji.pg_next))
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(page >= TOTAL),
                new ButtonBuilder()
                        .setCustomId(`help:jump:${page}:${userId}`)
                        .setEmoji(parseEmoji(emoji.pg_jump))
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(TOTAL <= 1),
        );
}

function buildPage(page, cmdMap, userId) {
        const section = PAGES[page - 1];
        const mention = (name) => cmdMap[name] ? `</${name}:${cmdMap[name]}>` : `\`/${name}\``;
        const lines   = section.commands
                .map(name => `${mention(name)}  ${section.descriptions[name]}`)
                .join('\n');

        return new ContainerBuilder()
                .setAccentColor(0xffffff)
                .addMediaGalleryComponents(
                        new MediaGalleryBuilder().addItems(
                                new MediaGalleryItemBuilder().setURL('attachment://help_banner.png'),
                        ),
                )
                .addSeparatorComponents(
                        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true),
                )
                .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`${section.title}\n${lines}`),
                )
                .addSeparatorComponents(
                        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true),
                )
                .addActionRowComponents(buildNavRow(page, userId));
}

function banner() {
        return new AttachmentBuilder(BANNER, { name: 'help_banner.png' });
}

class HelpCommand extends Command {
        constructor() {
                super({
                        name: 'help',
                        description: 'View all available commands',
                        cooldown: 5,
                        enabledSlash: true,
                        shouldNotDefer: true,
                        slashData: {
                                name: 'help',
                                description: 'View all available commands',
                        },
                });
        }

        async execute({ ctx }) {
                const cmdMap = await getCmdMap(ctx.client);

                await ctx.reply({
                        components: [buildPage(1, cmdMap, ctx.user.id)],
                        files:      [banner()],
                        flags:      MessageFlags.IsComponentsV2,
                });

                const msg       = await ctx.fetchReply();
                const collector = msg.createMessageComponentCollector({ idle: 180_000 });

                collector.on('collect', async (i) => {
                        if (i.user.id !== ctx.user.id) {
                                return i.reply({
                                        content: 'This menu belongs to someone else.',
                                        flags:   MessageFlags.Ephemeral,
                                });
                        }

                        const parts = i.customId.split(':');

                        if (parts[1] === 'prev' || parts[1] === 'next') {
                                const cur     = parseInt(parts[2]);
                                const newPage = Math.max(1, Math.min(TOTAL, parts[1] === 'prev' ? cur - 1 : cur + 1));
                                await i.deferUpdate();
                                await i.editReply({
                                        components: [buildPage(newPage, cmdMap, ctx.user.id)],
                                        files:      [banner()],
                                });

                        } else if (parts[1] === 'jump') {
                                const modal = new ModalBuilder()
                                        .setCustomId('help_jump')
                                        .setTitle('Jump to Page')
                                        .addComponents(
                                                new ActionRowBuilder().addComponents(
                                                        new TextInputBuilder()
                                                                .setCustomId('page_num')
                                                                .setLabel(`Page number (1 – ${TOTAL})`)
                                                                .setStyle(TextInputStyle.Short)
                                                                .setMinLength(1)
                                                                .setMaxLength(1)
                                                                .setRequired(true),
                                                ),
                                        );

                                await i.showModal(modal);

                                const sub = await i.awaitModalSubmit({
                                        time:   60_000,
                                        filter: m => m.user.id === ctx.user.id,
                                }).catch(() => null);

                                if (!sub) return;

                                const raw     = sub.fields.getTextInputValue('page_num').trim();
                                const newPage = Math.max(1, Math.min(TOTAL, parseInt(raw) || 1));

                                await sub.deferUpdate();
                                await sub.editReply({
                                        components: [buildPage(newPage, cmdMap, ctx.user.id)],
                                        files:      [banner()],
                                });
                        }
                });

                collector.on('end', async () => {
                        await disableComponents(msg).catch(() => {});
                });
        }
}

export default new HelpCommand();
