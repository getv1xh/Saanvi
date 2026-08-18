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

export const TRANSLATE_MESSAGE_PREFIX = 'translate:';
export const TRANSLATE_MESSAGE_LANGUAGE_PREFIX = `${TRANSLATE_MESSAGE_PREFIX}language`;
export const TRANSLATE_MESSAGE_RETRY_PREFIX = `${TRANSLATE_MESSAGE_PREFIX}retry`;
export const TRANSLATE_MESSAGE_LANGUAGE_MODAL_PREFIX = `${TRANSLATE_MESSAGE_PREFIX}languagemodal`;
export const TRANSLATE_MESSAGE_RETRY_MODAL_PREFIX = `${TRANSLATE_MESSAGE_PREFIX}retrymodal`;
export const TRANSLATE_MESSAGE_LANGUAGE_INPUT_ID = 'translate_message_language';
export const TRANSLATE_MESSAGE_CHANGES_INPUT_ID = 'translate_message_changes';
export const TRANSLATE_MESSAGE_TTL_SECONDS = 120;

export const createTranslateMessageId = () =>
        `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export const translateMessageSourceKey = (sourceId) =>
        `translate:source:${sourceId}`;

export const parseStoredTranslateMessageSource = (raw) => {
        if (!raw) return null;
        if (typeof raw === 'object') return raw;

        try {
                return JSON.parse(raw);
        } catch {
                return null;
        }
};

export const storeTranslateMessageSource = async (client, sourceId, source) => {
        await client.c.set(
                translateMessageSourceKey(sourceId),
                JSON.stringify({
                        ...source,
                        updatedAt: Date.now(),
                }),
                TRANSLATE_MESSAGE_TTL_SECONDS,
        );
};

const languageButton = (sourceId, userId) =>
        new ButtonBuilder()
                .setCustomId(
                        `${TRANSLATE_MESSAGE_LANGUAGE_PREFIX}:${sourceId}:${userId}`,
                )
                .setLabel('Different Language')
                .setStyle(ButtonStyle.Secondary);

const retryButton = (sourceId, userId) =>
        new ButtonBuilder()
                .setCustomId(
                        `${TRANSLATE_MESSAGE_RETRY_PREFIX}:${sourceId}:${userId}`,
                )
                .setLabel('Retry')
                .setStyle(ButtonStyle.Secondary);

const codeSafe = (value) =>
        String(value || '')
                .trim()
                .replace(/```/g, '`\u200b``');

const trimForDiscord = (value, max = 1700) => {
        const text = String(value || '').trim();
        if (text.length <= max) return text;
        return `${text.slice(0, max - 3).trim()}...`;
};

export const translateMessagePayload = ({
        translation,
        targetLanguage = 'English',
        status = null,
        footer = null,
        sourceId = null,
        userId = null,
        includeButtons = false,
}) => {
        const safeTranslation = codeSafe(
                trimForDiscord(
                        translation ||
                                'I could not translate that right now. Try again in a bit.',
                ),
        );
        const body = status
                ? `**${status}**`
                : `**Translated to ${trimForDiscord(targetLanguage, 80)}**\n\`\`\`\n${safeTranslation}\n\`\`\``;
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

        if (includeButtons && sourceId && userId) {
                container.addActionRowComponents(
                        new ActionRowBuilder().addComponents(
                                languageButton(sourceId, userId),
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

export const translateMessageLanguageModal = (sourceId, userId) =>
        new ModalBuilder()
                .setCustomId(
                        `${TRANSLATE_MESSAGE_LANGUAGE_MODAL_PREFIX}:${sourceId}:${userId}`,
                )
                .setTitle('Different Language')
                .addComponents(
                        new ActionRowBuilder().addComponents(
                                new TextInputBuilder()
                                        .setCustomId(
                                                TRANSLATE_MESSAGE_LANGUAGE_INPUT_ID,
                                        )
                                        .setLabel(
                                                'Translate to which language?',
                                        )
                                        .setPlaceholder(
                                                'Hindi, Spanish, Japanese, French...',
                                        )
                                        .setStyle(TextInputStyle.Short)
                                        .setMinLength(2)
                                        .setMaxLength(80)
                                        .setRequired(true),
                        ),
                );

export const translateMessageRetryModal = (sourceId, userId) =>
        new ModalBuilder()
                .setCustomId(
                        `${TRANSLATE_MESSAGE_RETRY_MODAL_PREFIX}:${sourceId}:${userId}`,
                )
                .setTitle('Retry Translation')
                .addComponents(
                        new ActionRowBuilder().addComponents(
                                new TextInputBuilder()
                                        .setCustomId(
                                                TRANSLATE_MESSAGE_CHANGES_INPUT_ID,
                                        )
                                        .setLabel('What changes are needed?')
                                        .setPlaceholder(
                                                'Make it more literal, explain confusing slang, keep names unchanged...',
                                        )
                                        .setStyle(TextInputStyle.Paragraph)
                                        .setMinLength(1)
                                        .setMaxLength(500)
                                        .setRequired(true),
                        ),
                );

export const scheduleTranslateMessageButtonRemoval = (
        message,
        payloadOptions,
) => {
        setTimeout(() => {
                message?.edit(
                        translateMessagePayload({
                                ...payloadOptions,
                                includeButtons: false,
                        }),
                ).catch(() => {});
        }, TRANSLATE_MESSAGE_TTL_SECONDS * 1000);
};
