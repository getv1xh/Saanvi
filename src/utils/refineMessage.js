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
        TextDisplayBuilder,
        TextInputBuilder,
        TextInputStyle,
} from 'discord.js';

export const REFINE_MESSAGE_PREFIX = 'refine:';
export const REFINE_MESSAGE_TONE_PREFIX = `${REFINE_MESSAGE_PREFIX}tone`;
export const REFINE_MESSAGE_RETRY_PREFIX = `${REFINE_MESSAGE_PREFIX}retry`;
export const REFINE_MESSAGE_CUSTOM_MODAL_PREFIX = `${REFINE_MESSAGE_PREFIX}custommodal`;
export const REFINE_MESSAGE_RETRY_MODAL_PREFIX = `${REFINE_MESSAGE_PREFIX}retrymodal`;
export const REFINE_MESSAGE_CUSTOM_TONE_INPUT_ID = 'refine_message_custom_tone';
export const REFINE_MESSAGE_CHANGES_INPUT_ID = 'refine_message_changes';
export const REFINE_MESSAGE_TTL_SECONDS = 120;

export const REFINE_MESSAGE_TONES = [
        {
                label: 'Normal',
                value: 'normal',
                description: 'Clear, natural English.',
        },
        {
                label: 'Professional',
                value: 'professional',
                description: 'Polished and respectful.',
        },
        {
                label: 'Other...',
                value: 'custom',
                description: 'Type your own tone.',
        },
];

export const createRefineMessageId = () =>
        `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export const refineMessageSourceKey = (sourceId) => `refine:source:${sourceId}`;

export const parseStoredRefineMessageSource = (raw) => {
        if (!raw) return null;
        if (typeof raw === 'object') return raw;

        try {
                return JSON.parse(raw);
        } catch {
                return null;
        }
};

export const storeRefineMessageSource = async (client, sourceId, source) => {
        await client.c.set(
                refineMessageSourceKey(sourceId),
                JSON.stringify({
                        ...source,
                        updatedAt: Date.now(),
                }),
                REFINE_MESSAGE_TTL_SECONDS,
        );
};

const toneSelect = (sourceId, userId) =>
        new StringSelectMenuBuilder()
                .setCustomId(
                        `${REFINE_MESSAGE_TONE_PREFIX}:${sourceId}:${userId}`,
                )
                .setPlaceholder('Choose a refine tone')
                .addOptions(REFINE_MESSAGE_TONES);

const retryButton = (sourceId, userId) =>
        new ButtonBuilder()
                .setCustomId(
                        `${REFINE_MESSAGE_RETRY_PREFIX}:${sourceId}:${userId}`,
                )
                .setLabel('Retry')
                .setStyle(ButtonStyle.Secondary);

const codeSafe = (value) =>
        String(value || '')
                .trim()
                .replace(/```/g, '`\u200b``');

export const formatRefinedMessages = (answer, refinements = null) => {
        const outputs = (
                Array.isArray(refinements) && refinements.length
                        ? refinements
                        : String(answer || '')
                                  .split(/\n-{3,}\n/g)
                                  .map((entry) => entry.trim())
        )
                .filter(Boolean)
                .slice(0, 4);

        if (!outputs.length) {
                return '```I could not refine that right now. Try again in a bit.```';
        }

        return outputs
                .map((output) => `\`\`\`\n${codeSafe(output)}\n\`\`\``)
                .join('\n');
};

export const refineMessageTonePayload = ({ sourceId, userId, preview }) => {
        const container = new ContainerBuilder()
                .setAccentColor(0xffffff)
                .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                                '**Refine Message**\nPick the tone for the refined English version.',
                        ),
                )
                .addSeparatorComponents(
                        new SeparatorBuilder()
                                .setSpacing(SeparatorSpacingSize.Small)
                                .setDivider(true),
                )
                .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`-# ${preview}`),
                )
                .addActionRowComponents(
                        new ActionRowBuilder().addComponents(
                                toneSelect(sourceId, userId),
                        ),
                );

        return {
                components: [container],
                flags: MessageFlags.IsComponentsV2,
                allowedMentions: { parse: [] },
        };
};

export const refineMessageGeneratedPayload = ({
        answer,
        refinements = null,
        status = null,
        footer = null,
        sourceId = null,
        userId = null,
        includeRetryButton = false,
}) => {
        const body = status
                ? `**${status}**`
                : `**Refined Message**\n${formatRefinedMessages(answer, refinements)}`;
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

        if (includeRetryButton && sourceId && userId) {
                container.addActionRowComponents(
                        new ActionRowBuilder().addComponents(
                                retryButton(sourceId, userId),
                        ),
                );
        }

        return {
                components: [container],
                flags: MessageFlags.IsComponentsV2,
                allowedMentions: { parse: [] },
        };
};

export const refineMessageCustomToneModal = (sourceId, userId) =>
        new ModalBuilder()
                .setCustomId(
                        `${REFINE_MESSAGE_CUSTOM_MODAL_PREFIX}:${sourceId}:${userId}`,
                )
                .setTitle('Custom Refine Tone')
                .addComponents(
                        new ActionRowBuilder().addComponents(
                                new TextInputBuilder()
                                        .setCustomId(
                                                REFINE_MESSAGE_CUSTOM_TONE_INPUT_ID,
                                        )
                                        .setLabel('Tone')
                                        .setPlaceholder(
                                                'friendly, formal, casual, flirty...',
                                        )
                                        .setStyle(TextInputStyle.Short)
                                        .setMinLength(2)
                                        .setMaxLength(80)
                                        .setRequired(true),
                        ),
                );

export const refineMessageRetryModal = (sourceId, userId) =>
        new ModalBuilder()
                .setCustomId(
                        `${REFINE_MESSAGE_RETRY_MODAL_PREFIX}:${sourceId}:${userId}`,
                )
                .setTitle('Retry Refine')
                .addComponents(
                        new ActionRowBuilder().addComponents(
                                new TextInputBuilder()
                                        .setCustomId(
                                                REFINE_MESSAGE_CHANGES_INPUT_ID,
                                        )
                                        .setLabel('What changes are needed?')
                                        .setPlaceholder(
                                                'Make it shorter, softer, more direct...',
                                        )
                                        .setStyle(TextInputStyle.Paragraph)
                                        .setMinLength(1)
                                        .setMaxLength(500)
                                        .setRequired(true),
                        ),
                );

export const scheduleRefineMessageButtonRemoval = (message, payloadOptions) => {
        setTimeout(() => {
                message?.edit(
                        refineMessageGeneratedPayload({
                                ...payloadOptions,
                                includeRetryButton: false,
                        }),
                ).catch(() => {});
        }, REFINE_MESSAGE_TTL_SECONDS * 1000);
};
