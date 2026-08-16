import { Command } from '#command';
import { db } from '#dbManager';
import { logger } from '#utils';

const extractUserId = (input) => String(input || '').match(/\d{17,20}/)?.[0] || null;

class RevokeCommand extends Command {
        constructor() {
                super({
                        name: 'revoke',
                        description: 'Revoke premium access from a user',
                        usage: 'revoke <userId|mention>',
                        category: 'developer',
                        ownerOnly: true,
                        enabledSlash: false,
                        prefix: true,
                        cooldown: 3,
                });
        }

        async execute({ ctx }) {
                const userId = extractUserId(ctx.args[0]);

                if (!userId) {
                        return ctx.reply('Usage: `!revoke <userId|mention>`');
                }

                try {
                        await db.user.revokePremium(userId);
                        return ctx.reply(`<:Heart_Red:1538521542798082060> **DONE.** __**Revoked premium from <@${userId}>.**__`);
                } catch (error) {
                        logger.error('Revoke', `Failed to revoke premium from ${userId}: ${error.message}`, error);
                        return ctx.reply('Failed to revoke premium.');
                }
        }
}

export default new RevokeCommand();
