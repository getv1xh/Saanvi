import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { Command } from '#command';
import {
        clearPullRestartState,
        getPm2ProcessTarget,
        logger,
        writePullRestartState,
} from '#utils';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '../../..');

const shellQuote = (value) => `'${String(value).replace(/'/g, `'\\''`)}'`;

const runDeployCommand = (pm2Target) =>
        new Promise((resolve) => {
                const command = `git pull --ff-only && pm2 restart ${shellQuote(pm2Target)}`;
                const child = spawn('sh', ['-lc', command], {
                        cwd: ROOT_DIR,
                        env: process.env,
                        stdio: ['ignore', 'pipe', 'pipe'],
                });

                let output = '';
                const collect = (chunk) => {
                        output += chunk.toString();
                        if (output.length > 4000) output = output.slice(-4000);
                };

                child.stdout.on('data', collect);
                child.stderr.on('data', collect);
                child.on('error', (error) => resolve({ code: 1, output: error.message }));
                child.on('close', (code) => resolve({ code, output }));
        });

class PullCommand extends Command {
        constructor() {
                super({
                        name: 'pull',
                        description: 'Pull latest code and restart the PM2 process',
                        usage: 'pull',
                        category: 'developer',
                        ownerOnly: true,
                        enabledSlash: false,
                        prefix: true,
                        cooldown: 10,
                });
        }

        async execute({ ctx }) {
                const pm2Target = getPm2ProcessTarget();

                await writePullRestartState({
                        channelId: ctx.channel.id,
                        guildId: ctx.guild.id,
                        userId: ctx.user.id,
                        pm2Target,
                });

                logger.info('Pull', `Pull requested by ${ctx.user.id}; restarting ${pm2Target}`);

                const { code, output } = await runDeployCommand(pm2Target);

                if (code === 0) {
                        await clearPullRestartState();
                        return ctx.reply('Done. Code pulled and PM2 restarted.');
                }

                await clearPullRestartState();
                logger.error('Pull', `Deploy command failed with code ${code}: ${output}`);

                const lastLine = output
                        .split('\n')
                        .map((line) => line.trim())
                        .filter(Boolean)
                        .at(-1);

                return ctx.reply(lastLine ? `Update failed. ${lastLine}` : 'Update failed.');
        }
}

export default new PullCommand();
