import fs from 'fs/promises';
import os from 'os';
import path from 'path';

const STATE_FILE = path.join(os.tmpdir(), 'saanvi-pull-restart.json');
const STATE_TTL_MS = 15 * 60 * 1000;

export const getPm2ProcessTarget = () =>
        process.env.PM2_PROCESS_NAME || process.env.name || process.env.pm_id || 'saanvi';

export const writePullRestartState = async (data) => {
        await fs.writeFile(
                STATE_FILE,
                JSON.stringify(
                        {
                                ...data,
                                createdAt: Date.now(),
                        },
                        null,
                        2,
                ),
                'utf8',
        );
};

export const clearPullRestartState = async () => {
        await fs.unlink(STATE_FILE).catch((error) => {
                if (error?.code !== 'ENOENT') throw error;
        });
};

export const consumePullRestartState = async () => {
        let raw;

        try {
                raw = await fs.readFile(STATE_FILE, 'utf8');
        } catch (error) {
                if (error?.code === 'ENOENT') return null;
                throw error;
        }

        await clearPullRestartState();

        const state = JSON.parse(raw);
        if (!state?.channelId || Date.now() - state.createdAt > STATE_TTL_MS) return null;

        return state;
};
