import { config } from '#config';

const GROQ_TRANSCRIPTIONS_URL =
        'https://api.groq.com/openai/v1/audio/transcriptions';

export class GroqError extends Error {
        constructor(message, status = null) {
                super(message);
                this.name = 'GroqError';
                this.status = status;
        }
}

const trimDiscord = (text, max = 3500) => {
        if (text.length <= max) return text;
        return `${text.slice(0, max - 20).trim()}...`;
};

export const transcribeGroqAudio = async ({
        buffer,
        filename,
        contentType = 'application/octet-stream',
        url,
}) => {
        const apiKey = config.groq.apiKey;
        if (!apiKey) throw new Error('GROQ_API_KEY is not configured.');
        if (!buffer?.length && !url) throw new Error('No audio data provided.');

        const form = new FormData();
        if (buffer?.length) {
                form.append(
                        'file',
                        new Blob([buffer], { type: contentType }),
                        filename || 'audio.mp3',
                );
        } else {
                form.append('url', url);
        }
        form.append('model', config.groq.transcriptionModel);
        form.append('response_format', 'json');
        form.append('temperature', '0.01');

        const response = await fetch(GROQ_TRANSCRIPTIONS_URL, {
                method: 'POST',
                headers: {
                        Authorization: `Bearer ${apiKey}`,
                },
                body: form,
        });

        const raw = await response.text();
        let data = null;

        try {
                data = raw ? JSON.parse(raw) : null;
        } catch {}

        if (!response.ok) {
                const message =
                        data?.error?.message || raw || response.statusText;
                throw new GroqError(message, response.status);
        }

        const text = String(data?.text || raw || '').trim();
        if (!text) throw new Error('Groq returned an empty transcript.');

        return {
                text: trimDiscord(text),
                model: config.groq.transcriptionModel,
        };
};
