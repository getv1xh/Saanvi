import { Command } from '#command';
import { db } from '#dbManager';
import { logger } from '#utils';

class GenerateCommand extends Command {
        constructor() {
                super({
                        name: 'generate',
                        description: 'Generate a premium redeem code',
                        usage: 'generate <duration>',
                        category: 'developer',
                        ownerOnly: true,
                        enabledSlash: false,
                        prefix: true,
                        cooldown: 3,
                });
        }

        async execute({ ctx }) {
                const duration = ctx.args[0];

                if (!duration) {
                        return ctx.reply('Usage: `!generate 1month`');
                }

                try {
                        const code = await db.premiumCode.create(duration, ctx.user.id);

                        if (!code) {
                                return ctx.reply('Invalid duration. Try `1day`, `1week`, `1month`, or `1year`.');
                        }

                        return ctx.reply(
                                '<:Heart_Red:1538521542798082060> **DONE.** __**Premium code generated.**__\n' +
                                `**Code:** \`${code.code}\`\n` +
                                `**Duration:** \`${code.durationLabel}\``,
                        );
                } catch (error) {
                        logger.error('Generate', `Failed to generate premium code: ${error.message}`, error);
                        return ctx.reply('Failed to generate premium code.');
                }
        }
}

export default new GenerateCommand();
