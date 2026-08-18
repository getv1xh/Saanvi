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

export const EXPLAIN_MESSAGE_PREFIX = 'explain:';
export const EXPLAIN_MESSAGE_RETRY_PREFIX = `${EXPLAIN_MESSAGE_PREFIX}retry`;
export const EXPLAIN_MESSAGE_RETRY_MODAL_PREFIX = `${EXPLAIN_MESSAGE_PREFIX}retrymodal`;
export const EXPLAIN_MESSAGE_CHANGES_INPUT_ID = 'explain_message_changes';
export const EXPLAIN_MESSAGE_TTL_SECONDS = 120;

export const createExplainMessageId = () =>
        `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export const explainMessageSourceKey = (sourceId) =>
        `explain:source:${sourceId}`;

export const parseStoredExplainMessageSource = (raw) => {
        if (!raw) return null;
        if (typeof raw === 'object') return raw;

        try {
                return JSON.parse(raw);
        } catch {
                return null;
        }
};

export const storeExplainMessageSource = async (client, sourceId, source) => {
        await client.c.set(
                explainMessageSourceKey(sourceId),
                JSON.stringify({
                        ...source,
                        updatedAt: Date.now(),
                }),
                EXPLAIN_MESSAGE_TTL_SECONDS,
        );
};

const retryButton = (sourceId, userId) =>
        new ButtonBuilder()
                .setCustomId(
                        `${EXPLAIN_MESSAGE_RETRY_PREFIX}:${sourceId}:${userId}`,
                )
                .setLabel('Retry')
                .setStyle(ButtonStyle.Secondary);

const trimForDiscord = (value, max = 1500) => {
        const text = String(value || '').trim();
        if (text.length <= max) return text;
        return `${text.slice(0, max - 3).trim()}...`;
};

export const explainMessagePayload = ({
        body,
        status = null,
        footer = null,
        sourceId = null,
        userId = null,
        includeRetryButton = false,
}) => {
        const content = status
                ? `**${status}**`
                : `**Explain Message**\n${trimForDiscord(body || 'I could not explain that right now. Try again in a bit.')}`;
        const container = new ContainerBuilder()
                .setAccentColor(0xffffff)
                .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(content),
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

        if (includeRetryButton && sourceId && userId) {
                container.addActionRowComponents(
                        new ActionRowBuilder().addComponents(
                                retryButton(sourceId, userId),
                        ),
                );
        }

        return {
                components: [container],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
                allowedMentions: { parse: [] },
        };
};

export const explainMessageRetryModal = (sourceId, userId) =>
        new ModalBuilder()
                .setCustomId(
                        `${EXPLAIN_MESSAGE_RETRY_MODAL_PREFIX}:${sourceId}:${userId}`,
                )
                .setTitle('Ask Model')
                .addComponents(
                        new ActionRowBuilder().addComponents(
                                new TextInputBuilder()
                                        .setCustomId(
                                                EXPLAIN_MESSAGE_CHANGES_INPUT_ID,
                                        )
                                        .setLabel('What changes are needed?')
                                        .setPlaceholder(
                                                'Make it shorter, explain the slang, use simpler words...',
                                        )
                                        .setStyle(TextInputStyle.Paragraph)
                                        .setMinLength(1)
                                        .setMaxLength(500)
                                        .setRequired(true),
                        ),
                );

export const scheduleExplainMessageButtonRemoval = (
        message,
        payloadOptions,
) => {
        setTimeout(() => {
                message?.edit(
                        explainMessagePayload({
                                ...payloadOptions,
                                includeRetryButton: false,
                        }),
                ).catch(() => {});
        }, EXPLAIN_MESSAGE_TTL_SECONDS * 1000);
};
