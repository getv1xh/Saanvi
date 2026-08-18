import { Command } from '#command';
import {
        ApplicationCommandOptionType,
        AttachmentBuilder,
        MessageFlags,
} from 'discord.js';
import {
        cartesiaSettingsPromptPayload,
        cartesiaSetupRequiredPayload,
        defaultCartesiaSettings,
        logger,
        readAloudOpenRouter,
        synthesizeCartesiaSpeech,
        ttsAudioPayload,
        ttsStatusPayload,
} from '#utils';
import { db } from '#dbManager';

const LOADING_EMOJI = '<a:loading:1538534708739051562>';
const MAX_TTS_CHARS = 1200;

const cleanTtsText = (input) =>
        String(input || '')
                .replace(/\s+/g, ' ')
                .trim()
                .slice(0, MAX_TTS_CHARS);

const getCartesiaOption = (ctx, name) =>
        ctx.options.getString(name, false)?.trim() || '';

const missingCartesiaSettings = (settings) => {
        const missing = [];
        if (!settings.apiKey) missing.push('API key');
        if (!settings.voice) missing.push('voice ID');
        if (!settings.model) missing.push('model');
        return missing;
};

const mergeCartesiaSettings = (stored, updates) => {
        const defaults = defaultCartesiaSettings();
        return {
                apiKey:
                        updates.apiKey !== undefined
                                ? updates.apiKey
                                : stored?.apiKey || null,
                voice:
                        updates.voice !== undefined
                                ? updates.voice
                                : stored?.voice || defaults.voice,
                model:
                        updates.model !== undefined
                                ? updates.model
                                : stored?.model || defaults.model,
        };
};

class TtsCommand extends Command {
        constructor() {
                super({
                        name: 'tts',
                        description: 'Generate text-to-speech audio',
                        cooldown: 25,
                        enabledSlash: true,
                        ephemeral: true,
                        prefix: false,
                        slashData: {
                                name: 'tts',
                                description: 'Generate text-to-speech audio',
                                options: [
                                        {
                                                type: ApplicationCommandOptionType.String,
                                                name: 'text',
                                                description:
                                                        'Text to turn into speech.',
                                                required: true,
                                                max_length: MAX_TTS_CHARS,
                                        },
                                        {
                                                type: ApplicationCommandOptionType.String,
                                                name: 'provider',
                                                description:
                                                        'TTS provider to use.',
                                                required: false,
                                                choices: [
                                                        {
                                                                name: 'Fish Audio (OpenRouter default)',
                                                                value: 'fish',
                                                        },
                                                        {
                                                                name: 'Cartesia',
                                                                value: 'cartesia',
                                                        },
                                                ],
                                        },
                                        {
                                                type: ApplicationCommandOptionType.String,
                                                name: 'cartesia_api_key',
                                                description:
                                                        'Save or update your Cartesia API key.',
                                                required: false,
                                                max_length: 160,
                                        },
                                        {
                                                type: ApplicationCommandOptionType.String,
                                                name: 'cartesia_voice',
                                                description:
                                                        'Save or update your Cartesia voice ID.',
                                                required: false,
                                                max_length: 100,
                                        },
                                        {
                                                type: ApplicationCommandOptionType.String,
                                                name: 'cartesia_model',
                                                description:
                                                        'Save or update your Cartesia model.',
                                                required: false,
                                                max_length: 40,
                                        },
                                ],
                        },
                });
        }

        async execute({ ctx }) {
                const input = cleanTtsText(ctx.options.getString('text', true));
                const updates = {
                        apiKey: getCartesiaOption(ctx, 'cartesia_api_key'),
                        voice: getCartesiaOption(ctx, 'cartesia_voice'),
                        model: getCartesiaOption(ctx, 'cartesia_model'),
                };
                const hasCartesiaUpdates = Object.values(updates).some(Boolean);
                const provider =
                        ctx.options.getString('provider', false) ||
                        (hasCartesiaUpdates ? 'cartesia' : 'fish');

                if (!input) {
                        return ctx.editReply(
                                ttsStatusPayload({
                                        body: '**No text found.**',
                                }),
                        );
                }

                await ctx.editReply(
                        ttsStatusPayload({
                                body: `${LOADING_EMOJI} **Generating speech...**`,
                        }),
                );

                try {
                        if (provider === 'cartesia') {
                                return await this.generateCartesia({
                                        ctx,
                                        input,
                                        updates,
                                });
                        }

                        return await this.generateFish({ ctx, input });
                } catch (error) {
                        logger.error(
                                'TTS',
                                `Speech request failed: ${error.message}`,
                                error,
                        );
                        return ctx.editReply(
                                ttsStatusPayload({
                                        body:
                                                '**I could not generate that audio right now.**\n' +
                                                'Check the provider settings and try again.',
                                }),
                        );
                }
        }

        async generateFish({ ctx, input }) {
                const result = await readAloudOpenRouter({ input });
                const filename = `tts-fish-${ctx.interaction.id}.mp3`;
                const attachment = new AttachmentBuilder(result.audio, {
                        name: filename,
                });

                await ctx.followUp(
                        ttsAudioPayload({
                                provider: 'Fish Audio',
                                model: result.model,
                                voice: result.voice,
                                attachment,
                        }),
                );

                return ctx.editReply(
                        ttsStatusPayload({
                                body: '**Done.**',
                        }),
                );
        }

        async generateCartesia({ ctx, input, updates }) {
                const userId = ctx.user.id;
                const stored = await db.user.getTtsSettings(userId);
                const updatePayload = {};

                for (const [key, value] of Object.entries(updates)) {
                        if (value) updatePayload[key] = value;
                }

                const saved = Object.keys(updatePayload).length
                        ? await db.user.setCartesiaTtsSettings(
                                  userId,
                                  updatePayload,
                          )
                        : stored;
                const settings = mergeCartesiaSettings(
                        saved?.cartesia || stored?.cartesia,
                        {},
                );
                const missing = missingCartesiaSettings(settings);

                if (missing.length) {
                        return ctx.editReply(
                                cartesiaSetupRequiredPayload({
                                        userId,
                                        missing,
                                }),
                        );
                }

                const result = await synthesizeCartesiaSpeech({
                        apiKey: settings.apiKey,
                        input,
                        model: settings.model,
                        voice: settings.voice,
                });
                const filename = `tts-cartesia-${ctx.interaction.id}.wav`;
                const attachment = new AttachmentBuilder(result.audio, {
                        name: filename,
                });

                await ctx.followUp(
                        ttsAudioPayload({
                                provider: 'Cartesia',
                                model: result.model,
                                voice: result.voice,
                                attachment,
                        }),
                );

                return ctx.editReply(cartesiaSettingsPromptPayload({ userId }));
        }
}

export default new TtsCommand();
