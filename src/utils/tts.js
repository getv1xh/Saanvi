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
import { defaultCartesiaSettings } from './cartesia.js';

export const TTS_CARTESIA_SETTINGS_PREFIX = 'tts:cartesia-settings';
export const TTS_CARTESIA_SETTINGS_MODAL_PREFIX = 'tts:cartesia-settings-modal';
export const TTS_PROVIDER_PREFIX = 'tts:provider';
export const TTS_CARTESIA_API_KEY_INPUT_ID = 'tts_cartesia_api_key';
export const TTS_CARTESIA_VOICE_INPUT_ID = 'tts_cartesia_voice';
export const TTS_CARTESIA_MODEL_INPUT_ID = 'tts_cartesia_model';
export const TTS_REQUEST_TTL_SECONDS = 180;

const ttsCustomId = (...parts) =>
        parts
                .filter(Boolean)
                .map((part) => String(part).replace(/:+$/g, ''))
                .join(':');

const text = (content) => new TextDisplayBuilder().setContent(content);

export const createTtsRequestId = () =>
        `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export const ttsRequestKey = (requestId) => `tts:request:${requestId}`;

export const parseStoredTtsRequest = (raw) => {
        if (!raw) return null;
        if (typeof raw === 'object') return raw;

        try {
                return JSON.parse(raw);
        } catch {
                return null;
        }
};

export const storeTtsRequest = async (client, requestId, request) => {
        await client.c.set(
                ttsRequestKey(requestId),
                JSON.stringify({
                        ...request,
                        updatedAt: Date.now(),
                }),
                TTS_REQUEST_TTL_SECONDS,
        );
};

export const ttsStatusPayload = ({
        body,
        accentColor = 0xffffff,
        ephemeral = true,
}) => {
        const container = new ContainerBuilder()
                .setAccentColor(accentColor)
                .addTextDisplayComponents(text(body));

        return {
                components: [container],
                flags:
                        MessageFlags.IsComponentsV2 |
                        (ephemeral ? MessageFlags.Ephemeral : 0),
                allowedMentions: { parse: [] },
        };
};

export const ttsProviderPayload = ({ requestId, userId }) => {
        const container = new ContainerBuilder()
                .setAccentColor(0xffffff)
                .addTextDisplayComponents(
                        text('**TTS**\nChoose a voice provider.'),
                )
                .addActionRowComponents(
                        new ActionRowBuilder().addComponents(
                                new ButtonBuilder()
                                        .setCustomId(
                                                ttsCustomId(
                                                        TTS_PROVIDER_PREFIX,
                                                        'fish',
                                                        requestId,
                                                        userId,
                                                ),
                                        )
                                        .setLabel('Fish Audio')
                                        .setStyle(ButtonStyle.Secondary),
                                new ButtonBuilder()
                                        .setCustomId(
                                                ttsCustomId(
                                                        TTS_PROVIDER_PREFIX,
                                                        'cartesia',
                                                        requestId,
                                                        userId,
                                                ),
                                        )
                                        .setLabel('Cartesia')
                                        .setStyle(ButtonStyle.Secondary),
                        ),
                );

        return {
                components: [container],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
                allowedMentions: { parse: [] },
        };
};

export const ttsAudioPayload = ({ attachment, duration }) => {
        return {
                content: `Generated in ${duration}`,
                files: [attachment],
                allowedMentions: { parse: [] },
        };
};

const settingsButton = (userId) =>
        new ButtonBuilder()
                .setCustomId(ttsCustomId(TTS_CARTESIA_SETTINGS_PREFIX, userId))
                .setLabel('Change Voice / Model')
                .setStyle(ButtonStyle.Secondary);

export const cartesiaSettingsPromptPayload = ({ userId }) => {
        const container = new ContainerBuilder()
                .setAccentColor(0xffffff)
                .addTextDisplayComponents(
                        text(
                                '**Cartesia Saved**\nWant to change your voice or model for next time?',
                        ),
                )
                .addActionRowComponents(
                        new ActionRowBuilder().addComponents(
                                settingsButton(userId),
                        ),
                );

        return {
                components: [container],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
                allowedMentions: { parse: [] },
        };
};

export const cartesiaSetupRequiredPayload = ({ userId, missing }) => {
        const container = new ContainerBuilder()
                .setAccentColor(0xffbe78)
                .addTextDisplayComponents(
                        text(
                                `**Cartesia Setup Needed**\nAdd your ${missing.join(', ')} before using Cartesia TTS.`,
                        ),
                )
                .addSeparatorComponents(
                        new SeparatorBuilder()
                                .setSpacing(SeparatorSpacingSize.Small)
                                .setDivider(true),
                )
                .addActionRowComponents(
                        new ActionRowBuilder().addComponents(
                                settingsButton(userId),
                        ),
                );

        return {
                components: [container],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
                allowedMentions: { parse: [] },
        };
};

const addValue = (input, value) => {
        const clean = String(value || '').trim();
        return clean ? input.setValue(clean.slice(0, 100)) : input;
};

export const cartesiaSettingsModal = (userId, settings = {}) => {
        const defaults = defaultCartesiaSettings();
        const currentModel = settings.model || defaults.model;
        const currentVoice = settings.voice || defaults.voice;

        const apiKeyInput = new TextInputBuilder()
                .setCustomId(TTS_CARTESIA_API_KEY_INPUT_ID)
                .setLabel('Cartesia API key')
                .setPlaceholder('Leave blank to keep the saved key')
                .setStyle(TextInputStyle.Short)
                .setMaxLength(160)
                .setRequired(false);

        const voiceInput = addValue(
                new TextInputBuilder()
                        .setCustomId(TTS_CARTESIA_VOICE_INPUT_ID)
                        .setLabel('Voice ID')
                        .setPlaceholder(
                                'Example: db6b0ed5-d5d3-463d-ae85-518a07d3c2b4',
                        )
                        .setStyle(TextInputStyle.Short)
                        .setMinLength(8)
                        .setMaxLength(100)
                        .setRequired(true),
                currentVoice,
        );

        const modelInput = addValue(
                new TextInputBuilder()
                        .setCustomId(TTS_CARTESIA_MODEL_INPUT_ID)
                        .setLabel('Model')
                        .setPlaceholder('sonic-3.5')
                        .setStyle(TextInputStyle.Short)
                        .setMinLength(3)
                        .setMaxLength(40)
                        .setRequired(true),
                currentModel,
        );

        return new ModalBuilder()
                .setCustomId(
                        ttsCustomId(TTS_CARTESIA_SETTINGS_MODAL_PREFIX, userId),
                )
                .setTitle('Cartesia TTS Settings')
                .addComponents(
                        new ActionRowBuilder().addComponents(apiKeyInput),
                        new ActionRowBuilder().addComponents(voiceInput),
                        new ActionRowBuilder().addComponents(modelInput),
                );
};
