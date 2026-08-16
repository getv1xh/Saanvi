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
                                'Saanvi is currently limited to premium users.\n\n' +
                                `**Pricing**\n${config.premium.pricing}\n\n` +
                                'Redeem a code with `!redeem <code>` after purchase.',
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

export const premiumPromptOptions = premiumPromptPayload;
