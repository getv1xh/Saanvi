import {
        ActionRowBuilder,
        ButtonBuilder,
        ButtonStyle,
        ContainerBuilder,
        MessageFlags,
        ModalBuilder,
        SeparatorBuilder,
        SeparatorSpacingSize,
        TextDisplayBuilder,
        TextInputBuilder,
        TextInputStyle,
} from 'discord.js';

export const ASK_COMPONENT_PREFIX = 'ask:';
export const ASK_REPLY_PREFIX = `${ASK_COMPONENT_PREFIX}reply`;
export const ASK_REPLY_MODAL_PREFIX = `${ASK_COMPONENT_PREFIX}replymodal`;
export const ASK_REPLY_MESSAGE_INPUT_ID = 'ask_reply_message';
export const ASK_CONVERSATION_TTL_SECONDS = 120;

const MAX_CONTEXT_MESSAGES = 10;

export const createAskConversationId = () =>
        `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export const askConversationKey = (conversationId) =>
        `ask:conversation:${conversationId}`;

export const parseStoredAskConversation = (raw) => {
        if (!raw) return null;
        if (typeof raw === 'object') return raw;

        try {
                return JSON.parse(raw);
        } catch {
                return null;
        }
};

export const trimAskConversationMessages = (messages = []) =>
        messages
                .filter(
                        (message) =>
                                ['user', 'assistant'].includes(message?.role) &&
                                typeof message?.content === 'string' &&
                                message.content.trim(),
                )
                .slice(-MAX_CONTEXT_MESSAGES);

export const askReplyButton = (conversationId, userId) =>
        new ButtonBuilder()
                .setCustomId(`${ASK_REPLY_PREFIX}:${conversationId}:${userId}`)
                .setLabel('Reply')
                .setStyle(ButtonStyle.Secondary);

export const askReplyModal = (conversationId, userId) =>
        new ModalBuilder()
                .setCustomId(
                        `${ASK_REPLY_MODAL_PREFIX}:${conversationId}:${userId}`,
                )
                .setTitle('Ask Reply')
                .addComponents(
                        new ActionRowBuilder().addComponents(
                                new TextInputBuilder()
                                        .setCustomId(ASK_REPLY_MESSAGE_INPUT_ID)
                                        .setLabel('Message')
                                        .setStyle(TextInputStyle.Paragraph)
                                        .setMinLength(1)
                                        .setMaxLength(1000)
                                        .setRequired(true),
                        ),
                );

export const askResponsePayload = ({
        body,
        footer = null,
        conversationId = null,
        userId = null,
        includeReplyButton = false,
}) => {
        const container = new ContainerBuilder()
                .setAccentColor(0xffffff)
                .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(body),
                );

        if (footer) {
                container
                        .addSeparatorComponents(
                                new SeparatorBuilder()
                                        .setSpacing(SeparatorSpacingSize.Small)
                                        .setDivider(true),
                        )
                        .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                        `-# ${footer}`,
                                ),
                        );
        }

        if (includeReplyButton && conversationId && userId) {
                container.addActionRowComponents(
                        new ActionRowBuilder().addComponents(
                                askReplyButton(conversationId, userId),
                        ),
                );
        }

        return {
                components: [container],
                flags: MessageFlags.IsComponentsV2,
        };
};

export const storeAskConversation = async (
        client,
        conversationId,
        conversation,
) => {
        await client.c.set(
                askConversationKey(conversationId),
                JSON.stringify({
                        ...conversation,
                        messages: trimAskConversationMessages(
                                conversation.messages,
                        ),
                        updatedAt: Date.now(),
                }),
                ASK_CONVERSATION_TTL_SECONDS,
        );
};

export const scheduleAskReplyButtonRemoval = (message, payloadOptions) => {
        setTimeout(() => {
                message?.edit(
                        askResponsePayload({
                                ...payloadOptions,
                                includeReplyButton: false,
                        }),
                ).catch(() => {});
        }, ASK_CONVERSATION_TTL_SECONDS * 1000);
};
