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
        },
        watermark: 'developer credits: VEO @theveo.wtf',
        version: '2.0.0',

        tatum: {
                apiKey: process.env.TATUM_API_KEY || '',
        },

        openrouter: {
                apiKey: process.env.OPENROUTER_API_KEY || '',
                askModel: process.env.ASK_MODEL || 'openrouter/auto',
                referer: process.env.OPENROUTER_REFERER || '',
                title: process.env.OPENROUTER_TITLE || 'Saanvi',
                webEngine: process.env.ASK_WEB_ENGINE || '',
                webMode: process.env.ASK_WEB_MODE || '',
                webMaxResults: numberEnv(process.env.ASK_WEB_MAX_RESULTS, 3),
                maxTokens: numberEnv(process.env.ASK_MAX_TOKENS, 700),
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
