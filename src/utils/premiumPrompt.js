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
export const PREMIUM_PRICING_BUTTON_ID = 'premium:pricing';

export const canBypassPremium = (command) => {
        const name = Array.isArray(command?.name)
                ? command.name.join(':').toLowerCase()
                : String(command?.name || '').toLowerCase();

        return !!command?.ownerOnly || PREMIUM_BYPASS_COMMANDS.has(name);
};

export const premiumPromptPayload = () => {
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
                                        .setCustomId(PREMIUM_PRICING_BUTTON_ID)
                                        .setLabel('Pricing')
                                        .setStyle(ButtonStyle.Secondary),
                        ),
                );

        return {
                components: [container],
                flags: MessageFlags.IsComponentsV2,
        };
};

export const premiumPromptOptions = premiumPromptPayload;

export const premiumPricingPayload = () => {
        const container = new ContainerBuilder()
                .setAccentColor(0xffffff)
                .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                                '**Premium Pricing**\n' +
                                `<:premium:1538553546352361572> **${config.premium.pricing}**\n\n` +
                                '**What you get**\n' +
                                '> Full access to Saanvi commands\n' +
                                '> Crypto utilities and wallet tools\n' +
                                '> `/ask` AI utility access\n' +
                                '> Premium-only future utility features\n\n' +
                                'After purchase, redeem with `!redeem <code>`.',
                        ),
                )
                .addSeparatorComponents(
                        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true),
                )
                .addActionRowComponents(
                        new ActionRowBuilder().addComponents(
                                new ButtonBuilder()
                                        .setLabel('Get Premium')
                                        .setStyle(ButtonStyle.Link)
                                        .setURL(config.links.premium),
                        ),
                );

        return {
                components: [container],
                flags: MessageFlags.IsComponentsV2,
        };
};
