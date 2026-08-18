import 'dotenv/config';

const environment = process.env.NODE_ENV || 'development';
const isProduction = environment === 'production';
const numberEnv = (value, fallback) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
};

export const config = {
        token: process.env.TOKEN || '',
        clientId: process.env.CLIENT_ID || '',
        prefix: '.',
        ownerIds: process.env.OWNER_IDS ? process.env.OWNER_IDS.split(',') : [1124248109472550993],

        colors: {
                bot: [214, 211, 203],
                error: [230, 190, 175],
                success: [140, 200, 170],
                warn: [255, 190, 120],
        },
        links: {
                invite:  'https://discord.com/oauth2/authorize?client_id=1516858272814993469',
                install: 'https://discord.com/oauth2/authorize?client_id=1516858272814993469&integration_type=1&scope=applications.commands',
                premium: process.env.PREMIUM_URL || 'https://discord.gg/aerox',
        },
        premium: {
                enabled: process.env.PREMIUM_ENABLED !== 'false',
                pricing: process.env.PREMIUM_PRICING || '$3.99 / month',
        },
        watermark: 'developer credits: VEO @theveo.wtf',
        version: '2.0.0',

        tatum: {
                apiKey: process.env.TATUM_API_KEY || '',
        },

        openrouter: {
                apiKey: process.env.OPENROUTER_API_KEY || '',
                askModel: process.env.ASK_MODEL || 'openrouter/auto',
                askWebModel: process.env.ASK_WEB_MODEL || '',
                suggestReplyModel: process.env.SUGGEST_REPLY_MODEL || 'google/gemma-4-26b-a4b-it:free',
                readAloudModel: process.env.READ_ALOUD_MODEL || 'fish-audio/s2.1-pro-free:free',
                readAloudVoice: process.env.READ_ALOUD_VOICE || 'ce3b16c14af54adebba5ebe50a3d4417',
                referer: process.env.OPENROUTER_REFERER || '',
                title: process.env.OPENROUTER_TITLE || 'Saanvi',
                webEngine: process.env.ASK_WEB_ENGINE || '',
                webMode: process.env.ASK_WEB_MODE || '',
                webMaxResults: numberEnv(process.env.ASK_WEB_MAX_RESULTS, 3),
                maxTokens: numberEnv(process.env.ASK_MAX_TOKENS, 700),
        },

        cartesia: {
                apiVersion: process.env.CARTESIA_API_VERSION || '2026-08-14',
                defaultModel: process.env.CARTESIA_DEFAULT_MODEL || 'sonic-3.5',
                defaultVoice: process.env.CARTESIA_DEFAULT_VOICE || '',
        },

        groq: {
                apiKey: process.env.GROQ_API_KEY || '',
                transcriptionModel: process.env.GROQ_TRANSCRIPTION_MODEL || 'whisper-large-v3-turbo',
                maxTranscriptionBytes: numberEnv(process.env.GROQ_TRANSCRIPTION_MAX_BYTES, 25 * 1024 * 1024),
        },

        slashCommands: {
                guildId: process.env.SLASH_GUILD_ID || process.env.DEV_GUILD_ID || '',
                scope: process.env.SLASH_COMMAND_SCOPE || (process.env.SLASH_GUILD_ID || process.env.DEV_GUILD_ID ? 'guild' : 'global'),
        },

        database: {
                url: process.env.MONGODB_URI || '',
        },

        cache: {
                type: 'memory',
                maxSize: isProduction ? 100000 : 50000,
                flushOnStart: false,
                flushOnShutdown: false,
        },

        presences: [
                { status: 'online', activity: { type: 3, name: 'stars load...' } },
                { status: 'idle',   activity: { type: 2, name: 'soft clicks' } },
                { status: 'online', activity: { type: 0, name: 'brewing tiny commands' } },
                { status: 'idle',   activity: { type: 3, name: 'moonlit utility mode' } },
                { status: 'online', activity: { type: 3, name: 'stars, charts & tiny tasks' } },
        ],

        debug: !isProduction,
        environment,
};
