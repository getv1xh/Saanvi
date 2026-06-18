import 'dotenv/config';

const environment = process.env.NODE_ENV || 'development';
const isProduction = environment === 'production';

export const config = {
        token: process.env.TOKEN || 'MTUxNjg1ODI3MjgxNDk5MzQ2OQ.Gja-2E.Hvm_vyXZmkji4ZdksiLSIif05TQ4Atj39UjTXI',
        clientId: process.env.CLIENT_ID || '1516858272814993469',
        prefix: '.',
        ownerIds: process.env.OWNER_IDS ? process.env.OWNER_IDS.split(',') : [1124248109472550993],

        colors: {
                bot: [214, 211, 203],
                error: [230, 190, 175],
                success: [140, 200, 170],
                warn: [255, 190, 120],
        },
        links: {
                supportServer: 'https://discord.gg/aerox',
                invite:  'https://discord.com/oauth2/authorize?client_id=1516858272814993469',
                install: 'https://discord.com/oauth2/authorize?client_id=1516858272814993469&integration_type=1&scope=applications.commands',
        },
        watermark: 'coded by itsfizys',
        version: '2.0.0',

        tatum: {
                apiKey: process.env.TATUM_API_KEY || 't-6a32e1360800fc78aa4f2dc1-8cc48e42e29f4948a7181cd0',
        },

        database: {
                url: process.env.MONGODB_URI || 'mongodb+srv://Flake:Flake22222@frost-cluster.ef3hz4o.mongodb.net/?appName=Frost-Cluster',
        },

        cache: {
                type: 'memory',
                maxSize: isProduction ? 100000 : 50000,
                flushOnStart: false,
                flushOnShutdown: false,
        },

        presences: [
                { status: 'dnd',    activity: { type: 3, name: 'the blockchain burn' } },
                { status: 'online', activity: { type: 2, name: 'transaction confirmations' } },
                { status: 'idle',   activity: { type: 3, name: 'markets bleed in silence' } },
                { status: 'dnd',    activity: { type: 5, name: 'the bear market' } },
                { status: 'online', activity: { type: 3, name: 'wallets drain overnight' } },
                { status: 'idle',   activity: { type: 2, name: 'the mempool whisper' } },
        ],

        debug: !isProduction,
        environment,
};
