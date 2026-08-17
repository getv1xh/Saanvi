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
export const SUPPORT_REPLY_PREFIX = `${SUPPORT_COMPONENT_PREFIX}reply`;
export const SUPPORT_REPLY_MODAL_PREFIX = `${SUPPORT_COMPONENT_PREFIX}replymodal`;
export const SUPPORT_MESSAGE_INPUT_ID = 'support_ticket_message';
export const SUPPORT_REPLY_MESSAGE_INPUT_ID = 'support_ticket_reply_message';
export const SUPPORT_TICKET_TTL_SECONDS = 60 * 60 * 24 * 30;

const ticketEmoji = { name: 'CodeXSupport', id: '1538562574625407128' };
const SUPPORT_EMOJI = '<:CodeXSupport:1538562574625407128>';
const DOTS_EMOJI = '<:dots:1538555958228164759>';
const CHAT_EMOJI = '<a:CHAT:1538828248308387896>';

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

const quoteBlock = (value) =>
        String(value || '')
                .split('\n')
                .map((line) => `> ${line || ' '}`)
                .join('\n');

export const supportCategoryPayload = (userId) => {
        const container = supportContainer(
                '**Support Ticket**\n' +
                        '<:CodeXSupport:1538562574625407128> Choose the category that fits your issue.',
        )
                .addSeparatorComponents(
                        new SeparatorBuilder()
                                .setSpacing(SeparatorSpacingSize.Small)
                                .setDivider(true),
                )
                .addActionRowComponents(
                        new ActionRowBuilder().addComponents(
                                new StringSelectMenuBuilder()
                                        .setCustomId(
                                                supportCustomId(
                                                        'category',
                                                        userId,
                                                ),
                                        )
                                        .setPlaceholder(
                                                'Select a support category',
                                        )
                                        .addOptions(
                                                new StringSelectMenuOptionBuilder()
                                                        .setLabel(
                                                                SUPPORT_CATEGORIES.general,
                                                        )
                                                        .setValue('general')
                                                        .setEmoji(ticketEmoji),
                                                new StringSelectMenuOptionBuilder()
                                                        .setLabel(
                                                                SUPPORT_CATEGORIES.bug,
                                                        )
                                                        .setValue('bug')
                                                        .setEmoji(ticketEmoji),
                                                new StringSelectMenuOptionBuilder()
                                                        .setLabel(
                                                                SUPPORT_CATEGORIES.payment,
                                                        )
                                                        .setValue('payment')
                                                        .setEmoji(ticketEmoji),
                                                new StringSelectMenuOptionBuilder()
                                                        .setLabel(
                                                                SUPPORT_CATEGORIES.other,
                                                        )
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
                                ? `${SUPPORT_EMOJI} | **Support Ticket Created**\n` +
                                          `> Ticket ${ticketId} was sent to the owner.\n` +
                                          `> Category: ${SUPPORT_CATEGORIES[category] || category}`
                                : '**Support Ticket Saved**\n' +
                                          `Ticket ${ticketId} was created, but I could not DM the owner right now.`,
                ),
        ],
        flags: MessageFlags.IsComponentsV2,
});

export const supportOwnerTicketPayload = (ticket, closed = false) => {
        const container = supportContainer(
                `${SUPPORT_EMOJI} | **${closed ? 'Support Ticket Closed' : 'Support Ticket'}**\n\n` +
                        `${DOTS_EMOJI} Ticket: ${ticket.id}\n` +
                        `${DOTS_EMOJI} User: ${ticket.userTag} (${ticket.userId})\n` +
                        `${DOTS_EMOJI} Category: ${SUPPORT_CATEGORIES[ticket.category] || ticket.category}\n\n` +
                        `${CHAT_EMOJI} | Message:\n${quoteBlock(ticket.message)}`,
        )
                .addSeparatorComponents(
                        new SeparatorBuilder()
                                .setSpacing(SeparatorSpacingSize.Small)
                                .setDivider(true),
                )
                .addActionRowComponents(
                        new ActionRowBuilder().addComponents(
                                new ButtonBuilder()
                                        .setCustomId(
                                                supportCustomId(
                                                        'reply',
                                                        ticket.id,
                                                        ticket.userId,
                                                ),
                                        )
                                        .setLabel('Reply')
                                        .setStyle(ButtonStyle.Secondary)
                                        .setDisabled(closed),
                                new ButtonBuilder()
                                        .setCustomId(
                                                supportCustomId(
                                                        'close',
                                                        ticket.id,
                                                        ticket.userId,
                                                ),
                                        )
                                        .setLabel(
                                                closed
                                                        ? 'Closed'
                                                        : 'Close Ticket',
                                        )
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

export const supportReplyModal = (ticketId, userId) =>
        new ModalBuilder()
                .setCustomId(supportCustomId('replymodal', ticketId, userId))
                .setTitle('Support Ticket Reply')
                .addComponents(
                        new ActionRowBuilder().addComponents(
                                new TextInputBuilder()
                                        .setCustomId(
                                                SUPPORT_REPLY_MESSAGE_INPUT_ID,
                                        )
                                        .setLabel('Reply message')
                                        .setStyle(TextInputStyle.Paragraph)
                                        .setMinLength(1)
                                        .setMaxLength(1000)
                                        .setRequired(true),
                        ),
                );

export const supportReplyUserPayload = (ticket, message) => ({
        components: [
                supportContainer(
                        `${SUPPORT_EMOJI} | **Support Ticket Reply**\n\n` +
                                `${DOTS_EMOJI} Ticket: ${ticket.id}\n` +
                                `${DOTS_EMOJI} Category: ${SUPPORT_CATEGORIES[ticket.category] || ticket.category}\n\n` +
                                `${CHAT_EMOJI} | Message:\n${quoteBlock(message)}`,
                ),
        ],
        flags: MessageFlags.IsComponentsV2,
});

export const supportClosedUserPayload = (ticket) => ({
        components: [
                supportContainer(
                        '**Support Ticket Closed**\n' +
                                `Your ticket ${ticket.id} was closed.\n` +
                                'You can open a new ticket now.',
                ),
        ],
        flags: MessageFlags.IsComponentsV2,
});
