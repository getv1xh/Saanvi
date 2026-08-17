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

export const SUGGEST_REPLY_PREFIX = 'suggestreply:';
export const SUGGEST_REPLY_TONE_PREFIX = `${SUGGEST_REPLY_PREFIX}tone`;
export const SUGGEST_REPLY_RETRY_PREFIX = `${SUGGEST_REPLY_PREFIX}retry`;
export const SUGGEST_REPLY_CUSTOM_MODAL_PREFIX = `${SUGGEST_REPLY_PREFIX}custommodal`;
export const SUGGEST_REPLY_RETRY_MODAL_PREFIX = `${SUGGEST_REPLY_PREFIX}retrymodal`;
export const SUGGEST_REPLY_CUSTOM_TONE_INPUT_ID = 'suggest_reply_custom_tone';
export const SUGGEST_REPLY_CHANGES_INPUT_ID = 'suggest_reply_changes';
export const SUGGEST_REPLY_TTL_SECONDS = 120;

export const SUGGEST_REPLY_TONES = [
        {
                label: 'Normal',
                value: 'normal',
                description: 'Simple and natural.',
        },
        {
                label: 'Angry',
                value: 'angry',
                description: 'Direct and irritated.',
        },
        {
                label: 'Professional',
                value: 'professional',
                description: 'Polished and respectful.',
        },
        { label: 'Savage', value: 'savage', description: 'Sharp but usable.' },
        {
                label: 'Chaotic',
                value: 'chaotic',
                description: 'Messy, dramatic, and funny.',
        },
        {
                label: 'Playful',
                value: 'playful',
                description: 'Light and teasing.',
        },
        {
                label: 'Custom tone...',
                value: 'custom',
                description: 'Type your own tone.',
        },
];

export const createSuggestReplyId = () =>
        `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export const suggestReplySourceKey = (sourceId) =>
        `suggestreply:source:${sourceId}`;

export const parseStoredSuggestReplySource = (raw) => {
        if (!raw) return null;
        if (typeof raw === 'object') return raw;

        try {
                return JSON.parse(raw);
        } catch {
                return null;
        }
};

export const storeSuggestReplySource = async (client, sourceId, source) => {
        await client.c.set(
                suggestReplySourceKey(sourceId),
                JSON.stringify({
                        ...source,
                        updatedAt: Date.now(),
                }),
                SUGGEST_REPLY_TTL_SECONDS,
        );
};

const toneSelect = (sourceId, userId) =>
        new StringSelectMenuBuilder()
                .setCustomId(
                        `${SUGGEST_REPLY_TONE_PREFIX}:${sourceId}:${userId}`,
                )
                .setPlaceholder('Choose a reply tone')
                .addOptions(SUGGEST_REPLY_TONES);

const retryButton = (sourceId, userId) =>
        new ButtonBuilder()
                .setCustomId(
                        `${SUGGEST_REPLY_RETRY_PREFIX}:${sourceId}:${userId}`,
                )
                .setLabel('Retry')
                .setStyle(ButtonStyle.Secondary);

export const suggestReplyTonePayload = ({ sourceId, userId, preview }) => {
        const container = new ContainerBuilder()
                .setAccentColor(0xffffff)
                .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                                '**Suggest Reply**\nPick the tone for the reply.',
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
        };
};

export const suggestReplyGeneratedPayload = ({
        answer,
        footer = null,
        sourceId = null,
        userId = null,
        includeRetryButton = false,
}) => {
        const container = new ContainerBuilder()
                .setAccentColor(0xffffff)
                .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                                `**Suggested Reply**\n${answer}`,
                        ),
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
        };
};

export const suggestReplyCustomToneModal = (sourceId, userId) =>
        new ModalBuilder()
                .setCustomId(
                        `${SUGGEST_REPLY_CUSTOM_MODAL_PREFIX}:${sourceId}:${userId}`,
                )
                .setTitle('Custom Reply Tone')
                .addComponents(
                        new ActionRowBuilder().addComponents(
                                new TextInputBuilder()
                                        .setCustomId(
                                                SUGGEST_REPLY_CUSTOM_TONE_INPUT_ID,
                                        )
                                        .setLabel('Reply tone')
                                        .setPlaceholder(
                                                'friendly but firm, flirty, sarcastic...',
                                        )
                                        .setStyle(TextInputStyle.Short)
                                        .setMinLength(2)
                                        .setMaxLength(80)
                                        .setRequired(true),
                        ),
                );

export const suggestReplyRetryModal = (sourceId, userId) =>
        new ModalBuilder()
                .setCustomId(
                        `${SUGGEST_REPLY_RETRY_MODAL_PREFIX}:${sourceId}:${userId}`,
                )
                .setTitle('Retry Suggestion')
                .addComponents(
                        new ActionRowBuilder().addComponents(
                                new TextInputBuilder()
                                        .setCustomId(
                                                SUGGEST_REPLY_CHANGES_INPUT_ID,
                                        )
                                        .setLabel('What changes are needed?')
                                        .setPlaceholder(
                                                'Make it shorter, more savage, less formal...',
                                        )
                                        .setStyle(TextInputStyle.Paragraph)
                                        .setMinLength(1)
                                        .setMaxLength(500)
                                        .setRequired(true),
                        ),
                );

export const scheduleSuggestReplyButtonRemoval = (message, payloadOptions) => {
        setTimeout(() => {
                message?.edit(
                        suggestReplyGeneratedPayload({
                                ...payloadOptions,
                                includeRetryButton: false,
                        }),
                ).catch(() => {});
        }, SUGGEST_REPLY_TTL_SECONDS * 1000);
};
