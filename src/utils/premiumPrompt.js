import {
        ActionRowBuilder,
        ButtonBuilder,
        ButtonStyle,
        ContainerBuilder,
        MessageFlags,
        SeparatorBuilder,
        SeparatorSpacingSize,
        TextDisplayBuilder,
} from 'discord.js';
import { config } from '#config';

export const PREMIUM_BYPASS_COMMANDS = new Set(['redeem']);
export const PREMIUM_COMPONENT_PREFIX = 'premium:';
export const PREMIUM_PRICING_BUTTON_ID = `${PREMIUM_COMPONENT_PREFIX}pricing`;

const premiumEmoji = { name: 'premium', id: '1538553546352361572' };
const userEmoji = { name: 'rluser', id: '1538556191897288835' };
const heartEmoji = { name: 'am_white_heart', id: '1538556413121405048', animated: true };
const moneyEmoji = { name: 'an_white_money', id: '1538558811491668030', animated: true };

export const canBypassPremium = (command) => {
        const name = Array.isArray(command?.name)
                ? command.name.join(':').toLowerCase()
                : String(command?.name || '').toLowerCase();

        return !!command?.ownerOnly || PREMIUM_BYPASS_COMMANDS.has(name);
};

const customId = (...parts) =>
        parts
                .filter(Boolean)
                .map((part) => String(part).replace(/:+$/g, ''))
                .join(':');

const userLabel = (userId) => userId || '0';

export const premiumPromptPayload = (userId = '0') => {
        const container = new ContainerBuilder()
                .setAccentColor(0xffffff)
                .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                                '**Premium Required**\n' +
                                '<:premium:1538553546352361572> __**Saanvi is currently limited to premium users.**__',
                        ),
                )
                .addSeparatorComponents(
                        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true),
                )
                .addActionRowComponents(
                        new ActionRowBuilder().addComponents(
                                new ButtonBuilder()
                                        .setCustomId(customId(PREMIUM_PRICING_BUTTON_ID, userLabel(userId)))
                                        .setLabel('Pricing')
                                        .setEmoji(premiumEmoji)
                                        .setStyle(ButtonStyle.Secondary),
                        ),
                );

        return {
                components: [container],
                flags: MessageFlags.IsComponentsV2,
        };
};

export const premiumPromptOptions = premiumPromptPayload;

export const premiumPricingPayload = (userId = '0') => {
        const container = new ContainerBuilder()
                .setAccentColor(0xffffff)
                .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                                '**Premium Pricing**\n' +
                                'Choose the access type you want.',
                        ),
                )
                .addSeparatorComponents(
                        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true),
                )
                .addActionRowComponents(
                        new ActionRowBuilder().addComponents(
                                new ButtonBuilder()
                                        .setCustomId(customId(PREMIUM_COMPONENT_PREFIX, 'plan', 'user', userLabel(userId)))
                                        .setLabel('User')
                                        .setEmoji(userEmoji)
                                        .setStyle(ButtonStyle.Secondary),
                                new ButtonBuilder()
                                        .setCustomId(customId(PREMIUM_COMPONENT_PREFIX, 'plan', 'server', userLabel(userId)))
                                        .setLabel('Server')
                                        .setEmoji(heartEmoji)
                                        .setStyle(ButtonStyle.Secondary),
                        ),
                );

        return {
                components: [container],
                flags: MessageFlags.IsComponentsV2,
        };
};

export const premiumPlanPayload = (plan, userId = '0') => {
        const isServer = plan === 'server';
        const title = isServer
                ? '<a:am_white_heart:1538556413121405048> **Server Premium**'
                : '<:rluser:1538556191897288835> **User Premium**';
        const features = isServer
                ? [
                        '> <:dots:1538555958228164759> Customise Saanvi as a assistant for ur server with ur server info',
                        '> <:dots:1538555958228164759> Customise Saanvi profile picture for your server',
                        '> <:dots:1538555958228164759> Server knowledge assistant: feed docs/info and Saanvi answers only relevant server questions',
                ]
                : [
                        '> <:dots:1538555958228164759> Full access to Saanvi User commands',
                        '> <:dots:1538555958228164759> Premium-only future utility features',
                ];

        const container = new ContainerBuilder()
                .setAccentColor(0xffffff)
                .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                                `${title}\n` +
                                `<:premium:1538553546352361572> **${config.premium.pricing}**\n\n` +
                                '**What you get**\n' +
                                features.join('\n'),
                        ),
                )
                .addSeparatorComponents(
                        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true),
                )
                .addActionRowComponents(
                        new ActionRowBuilder().addComponents(
                                new ButtonBuilder()
                                        .setCustomId(customId(PREMIUM_COMPONENT_PREFIX, 'request', plan, userLabel(userId)))
                                        .setLabel('Request Exclusive Access')
                                        .setEmoji(premiumEmoji)
                                        .setStyle(ButtonStyle.Secondary),
                        ),
                );

        return {
                components: [container],
                flags: MessageFlags.IsComponentsV2,
        };
};

export const premiumPaymentPayload = (plan, userId = '0') => {
        const container = new ContainerBuilder()
                .setAccentColor(0xffffff)
                .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                                '**Choose Payment Method**\n' +
                                'Select how you want to pay. I will send your request to the owner.',
                        ),
                )
                .addSeparatorComponents(
                        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true),
                )
                .addActionRowComponents(
                        new ActionRowBuilder().addComponents(
                                new ButtonBuilder()
                                        .setCustomId(customId(PREMIUM_COMPONENT_PREFIX, 'pay', plan, 'coingate', userLabel(userId)))
                                        .setLabel('Coingate Gift Card')
                                        .setEmoji(moneyEmoji)
                                        .setStyle(ButtonStyle.Secondary),
                                new ButtonBuilder()
                                        .setCustomId(customId(PREMIUM_COMPONENT_PREFIX, 'pay', plan, 'usdt_pol', userLabel(userId)))
                                        .setLabel('USDT POL')
                                        .setEmoji(moneyEmoji)
                                        .setStyle(ButtonStyle.Secondary),
                        ),
                )
                .addActionRowComponents(
                        new ActionRowBuilder().addComponents(
                                new ButtonBuilder()
                                        .setCustomId(customId(PREMIUM_COMPONENT_PREFIX, 'pay', plan, 'usdt_bep20', userLabel(userId)))
                                        .setLabel('USDT BEP20')
                                        .setEmoji(moneyEmoji)
                                        .setStyle(ButtonStyle.Secondary),
                                new ButtonBuilder()
                                        .setCustomId(customId(PREMIUM_COMPONENT_PREFIX, 'pay', plan, 'solana', userLabel(userId)))
                                        .setLabel('Solana')
                                        .setEmoji(moneyEmoji)
                                        .setStyle(ButtonStyle.Secondary),
                                new ButtonBuilder()
                                        .setCustomId(customId(PREMIUM_COMPONENT_PREFIX, 'pay', plan, 'litecoin', userLabel(userId)))
                                        .setLabel('Litecoin')
                                        .setEmoji(moneyEmoji)
                                        .setStyle(ButtonStyle.Secondary),
                        ),
                );

        return {
                components: [container],
                flags: MessageFlags.IsComponentsV2,
        };
};
