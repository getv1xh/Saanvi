import { Command } from '#command';
import { ApplicationCommandOptionType } from 'discord.js';
import {
        createTtsRequestId,
        storeTtsRequest,
        ttsProviderPayload,
        ttsStatusPayload,
} from '#utils';
const MAX_TTS_CHARS = 1200;

const cleanTtsText = (input) =>
        String(input || '')
                .replace(/\s+/g, ' ')
                .trim()
                .slice(0, MAX_TTS_CHARS);

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
                                                name: 'msg',
                                                description:
                                                        'Text to turn into speech.',
                                                required: true,
                                                max_length: MAX_TTS_CHARS,
                                        },
                                ],
                        },
                });
        }

        async execute({ ctx }) {
                const input = cleanTtsText(ctx.options.getString('msg', true));

                if (!input) {
                        return ctx.editReply(
                                ttsStatusPayload({
                                        body: '**No text found.**',
                                }),
                        );
                }

                const requestId = createTtsRequestId();
                await storeTtsRequest(ctx.client, requestId, {
                        userId: ctx.user.id,
                        input,
                });

                return ctx.editReply(
                        ttsProviderPayload({
                                requestId,
                                userId: ctx.user.id,
                        }),
                );
        }
}

export default new TtsCommand();
