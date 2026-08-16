import {
        ActionRowBuilder,
        ButtonBuilder,
        ButtonStyle,
        ContainerBuilder,
        MessageFlags,
        ModalBuilder,
        SeparatorBuilder,
        SeparatorSpacingSize,
        StringSelectMenuBuilder,
        StringSelectMenuOptionBuilder,
        TextDisplayBuilder,
        TextInputBuilder,
        TextInputStyle,
} from 'discord.js';

export const SUPPORT_COMPONENT_PREFIX = 'support:';
export const SUPPORT_CATEGORY_SELECT_PREFIX = `${SUPPORT_COMPONENT_PREFIX}category`;
export const SUPPORT_MODAL_PREFIX = `${SUPPORT_COMPONENT_PREFIX}modal`;
export const SUPPORT_CLOSE_PREFIX = `${SUPPORT_COMPONENT_PREFIX}close`;
export const SUPPORT_MESSAGE_INPUT_ID = 'support_ticket_message';
export const SUPPORT_TICKET_TTL_SECONDS = 60 * 60 * 24 * 30;

const ticketEmoji = { name: 'CodeXSupport', id: '1538562574625407128' };

export const SUPPORT_CATEGORIES = {
        general: 'General Question',
        bug: 'Bug Report',
        payment: 'Payment Issue',
        other: 'Others',
};

export const supportCustomId = (...parts) =>
        [SUPPORT_COMPONENT_PREFIX.replace(/:$/u, ''), ...parts]
                .filter(Boolean)
                .join(':');

export const supportActiveKey = (userId) => `support:ticket:active:${userId}`;
export const supportTicketKey = (ticketId) => `support:ticket:data:${ticketId}`;

export const createSupportTicketId = (userId) =>
        `${Date.now().toString(36)}${String(userId).slice(-4)}`;

const supportContainer = (content, accent = 0xffffff) =>
        new ContainerBuilder()
                .setAccentColor(accent)
                .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(content),
                );

export const supportCategoryPayload = (userId) => {
        const container = supportContainer(
                '**Support Ticket**\n' +
                '<:CodeXSupport:1538562574625407128> Choose the category that fits your issue.',
        )
                .addSeparatorComponents(
                        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true),
                )
                .addActionRowComponents(
                        new ActionRowBuilder().addComponents(
                                new StringSelectMenuBuilder()
                                        .setCustomId(supportCustomId('category', userId))
                                        .setPlaceholder('Select a support category')
                                        .addOptions(
                                                new StringSelectMenuOptionBuilder()
                                                        .setLabel(SUPPORT_CATEGORIES.general)
                                                        .setValue('general')
                                                        .setEmoji(ticketEmoji),
                                                new StringSelectMenuOptionBuilder()
                                                        .setLabel(SUPPORT_CATEGORIES.bug)
                                                        .setValue('bug')
                                                        .setEmoji(ticketEmoji),
                                                new StringSelectMenuOptionBuilder()
                                                        .setLabel(SUPPORT_CATEGORIES.payment)
                                                        .setValue('payment')
                                                        .setEmoji(ticketEmoji),
                                                new StringSelectMenuOptionBuilder()
                                                        .setLabel(SUPPORT_CATEGORIES.other)
                                                        .setValue('other')
                                                        .setEmoji(ticketEmoji),
                                        ),
                        ),
                );

        return {
                components: [container],
                flags: MessageFlags.IsComponentsV2,
        };
};

export const supportAlreadyOpenPayload = (ticketId) => ({
        components: [
                supportContainer(
                        '**Support Ticket Already Open**\n' +
                        `You already have an active ticket: \`${ticketId}\`.\n` +
                        'Please wait for the owner to close it before opening a new one.',
                ),
        ],
        flags: MessageFlags.IsComponentsV2,
});

export const supportModal = (userId, category) =>
        new ModalBuilder()
                .setCustomId(supportCustomId('modal', userId, category))
                .setTitle('Support Ticket')
                .addComponents(
                        new ActionRowBuilder().addComponents(
                                new TextInputBuilder()
                                        .setCustomId(SUPPORT_MESSAGE_INPUT_ID)
                                        .setLabel('Describe your issue')
                                        .setStyle(TextInputStyle.Paragraph)
                                        .setMinLength(5)
                                        .setMaxLength(1000)
                                        .setRequired(true),
                        ),
                );

export const supportSubmittedPayload = (ticketId, category, sent) => ({
        components: [
                supportContainer(
                        sent > 0
                                ? '**Support Ticket Created**\n' +
                                  `Ticket \`${ticketId}\` was sent to the owner.\n` +
                                  `**Category:** ${SUPPORT_CATEGORIES[category] || category}`
                                : '**Support Ticket Saved**\n' +
                                  `Ticket \`${ticketId}\` was created, but I could not DM the owner right now.`,
                ),
        ],
        flags: MessageFlags.IsComponentsV2,
});

export const supportOwnerTicketPayload = (ticket, closed = false) => {
        const container = supportContainer(
                (closed ? '**Support Ticket Closed**\n' : '**Support Ticket**\n') +
                `**Ticket:** \`${ticket.id}\`\n` +
                `**User:** ${ticket.userTag} (\`${ticket.userId}\`)\n` +
                `**Category:** ${SUPPORT_CATEGORIES[ticket.category] || ticket.category}\n\n` +
                `**Message:**\n${ticket.message}`,
        )
                .addSeparatorComponents(
                        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true),
                )
                .addActionRowComponents(
                        new ActionRowBuilder().addComponents(
                                new ButtonBuilder()
                                        .setCustomId(supportCustomId('close', ticket.id))
                                        .setLabel(closed ? 'Closed' : 'Close Ticket')
                                        .setStyle(ButtonStyle.Secondary)
                                        .setDisabled(closed),
                        ),
                );

        return {
                components: [container],
                flags: MessageFlags.IsComponentsV2,
                allowedMentions: { parse: [] },
        };
};

export const supportClosedUserPayload = (ticket) => ({
        components: [
                supportContainer(
                        '**Support Ticket Closed**\n' +
                        `Your ticket \`${ticket.id}\` was closed.\n` +
                        'You can open a new ticket now.',
                ),
        ],
        flags: MessageFlags.IsComponentsV2,
});
