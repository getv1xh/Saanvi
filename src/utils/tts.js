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
export const TTS_CARTESIA_API_KEY_INPUT_ID = 'tts_cartesia_api_key';
export const TTS_CARTESIA_VOICE_INPUT_ID = 'tts_cartesia_voice';
export const TTS_CARTESIA_MODEL_INPUT_ID = 'tts_cartesia_model';

const ttsCustomId = (...parts) =>
        parts
                .filter(Boolean)
                .map((part) => String(part).replace(/:+$/g, ''))
                .join(':');

const text = (content) => new TextDisplayBuilder().setContent(content);

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

export const ttsAudioPayload = ({
        provider,
        model,
        voice,
        attachment,
}) => {
        const details = [
                `provider: ${provider}`,
                model ? `model: ${model}` : null,
                voice ? `voice: ${voice}` : null,
        ]
                .filter(Boolean)
                .join(' | ');
        const container = new ContainerBuilder()
                .setAccentColor(0xffffff)
                .addTextDisplayComponents(text(`**TTS Done**\n-# ${details}`));

        return {
                components: [container],
                flags: MessageFlags.IsComponentsV2,
                allowedMentions: { parse: [] },
                files: [attachment],
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
