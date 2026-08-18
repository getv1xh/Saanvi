import { config } from '#config';

const CARTESIA_TTS_BYTES_URL = 'https://api.cartesia.ai/tts/bytes';
const MAX_CARTESIA_CHARS = 1200;

export class CartesiaError extends Error {
        constructor(message, status = null) {
                super(message);
                this.name = 'CartesiaError';
                this.status = status;
        }
}

const trimSpeech = (input) =>
        String(input || '')
                .replace(/\s+/g, ' ')
                .trim()
                .slice(0, MAX_CARTESIA_CHARS);

export const defaultCartesiaSettings = () => ({
        model: config.cartesia.defaultModel || 'sonic-3.5',
        voice: config.cartesia.defaultVoice || '',
});

export const synthesizeCartesiaSpeech = async ({
        apiKey,
        input,
        model,
        voice,
}) => {
        const transcript = trimSpeech(input);
        if (!transcript) throw new Error('No text to speak.');
        if (!apiKey) throw new CartesiaError('Cartesia API key is missing.');
        if (!voice) throw new CartesiaError('Cartesia voice ID is missing.');

        const response = await fetch(CARTESIA_TTS_BYTES_URL, {
                method: 'POST',
                headers: {
                        Authorization: `Bearer ${apiKey}`,
                        'Cartesia-Version':
                                config.cartesia.apiVersion || '2026-08-14',
                        'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                        model_id:
                                model ||
                                config.cartesia.defaultModel ||
                                'sonic-3.5',
                        transcript,
                        voice,
                        output_format: {
                                container: 'wav',
                                encoding: 'pcm_s16le',
                                sample_rate: 44100,
                        },
                }),
        });

        if (!response.ok) {
                const raw = await response.text().catch(() => '');
                let data = null;

                try {
                        data = raw ? JSON.parse(raw) : null;
                } catch {}

                const message =
                        data?.message ||
                        data?.error ||
                        data?.title ||
                        raw ||
                        response.statusText;
                throw new CartesiaError(message, response.status);
        }

        const audio = Buffer.from(await response.arrayBuffer());
        if (!audio.length) throw new Error('Cartesia returned empty audio.');

        return {
                audio,
                model: model || config.cartesia.defaultModel || 'sonic-3.5',
                voice,
        };
};
