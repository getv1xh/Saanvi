import { Command } from '#command';
import { db } from '#dbManager';
import { logger } from '#utils';

class RedeemCommand extends Command {
        constructor() {
                super({
                        name: 'redeem',
                        description: 'Redeem a premium access code',
                        usage: 'redeem <code>',
                        category: 'premium',
                        enabledSlash: false,
                        prefix: true,
                        cooldown: 5,
                });
        }

        async execute({ ctx }) {
                const codeInput = ctx.args[0];

                if (!codeInput) {
                        return ctx.reply('Usage: `!redeem <code>`');
                }

                try {
                        const code = await db.premiumCode.redeem(codeInput, ctx.user.id);

                        if (!code) {
                                const existing = await db.premiumCode.findByCode(codeInput);
                                return ctx.reply(existing ? 'This premium code has already been redeemed.' : 'Invalid premium code.');
                        }

                        const expiresAt = await db.user.grantPremium(ctx.user.id, code.durationMs);
                        const timestamp = Math.floor(expiresAt.getTime() / 1000);

                        return ctx.reply(
                                '<:Heart_Red:1538521542798082060> **DONE.** __**Premium activated.**__\n' +
                                `Expires <t:${timestamp}:R>`,
                        );
                } catch (error) {
                        logger.error('Redeem', `Failed to redeem premium code: ${error.message}`, error);
                        return ctx.reply('Failed to redeem premium code.');
                }
        }
}

export default new RedeemCommand();
