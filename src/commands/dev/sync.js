import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { Command } from '#command';
import { config } from '#config';
import { logger } from '#utils';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '../../..');

const runSyncCommand = () =>
        new Promise((resolve) => {
                if (!config.sync.command) {
                        return resolve({
                                code: 1,
                                output: 'DEV_SYNC_COMMAND is not configured.',
                        });
                }

                const child = spawn('sh', ['-lc', config.sync.command], {
                        cwd: ROOT_DIR,
                        env: process.env,
                        stdio: ['ignore', 'pipe', 'pipe'],
                });

                let settled = false;
                let output = '';

                const finish = (result) => {
                        if (settled) return;
                        settled = true;
                        clearTimeout(timer);
                        resolve(result);
                };

                const collect = (chunk) => {
                        output += chunk.toString();
                        if (output.length > 4000) output = output.slice(-4000);
                };

                const timer = setTimeout(() => {
                        child.kill('SIGTERM');
                        finish({
                                code: 124,
                                output: `Sync timed out after ${Math.round(config.sync.timeoutMs / 1000)}s.`,
                        });
                }, config.sync.timeoutMs);

                child.stdout.on('data', collect);
                child.stderr.on('data', collect);
                child.on('error', (error) => finish({ code: 1, output: error.message }));
                child.on('close', (code) => finish({ code, output }));
        });

class SyncCommand extends Command {
        constructor() {
                super({
                        name: 'sync',
                        description: 'Sync the latest code to the dev server',
                        usage: 'sync',
                        category: 'developer',
                        ownerOnly: true,
                        enabledSlash: false,
                        prefix: true,
                        cooldown: 10,
                });
        }

        async execute({ ctx }) {
                logger.info('Sync', `Sync requested by ${ctx.user.id}`);

                const { code, output } = await runSyncCommand();

                if (code === 0) {
                        return ctx.reply('<:Heart_Red:1538521542798082060> **DONE.** __**Code synced to dev server.**__');
                }

                logger.error('Sync', `Sync command failed with code ${code}: ${output}`);

                const lastLine = output
                        .split('\n')
                        .map((line) => line.trim())
                        .filter(Boolean)
                        .at(-1);

                return ctx.reply(lastLine ? `Sync failed. ${lastLine}` : 'Sync failed.');
        }
}

export default new SyncCommand();
