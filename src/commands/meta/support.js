import { Command } from '#command';
import {
        supportActiveKey,
        supportAlreadyOpenPayload,
        supportCategoryPayload,
} from '#utils';

class SupportCommand extends Command {
        constructor() {
                super({
                        name: 'support',
                        description: 'Open a premium support ticket',
                        cooldown: 10,
                        enabledSlash: true,
                        slashData: {
                                name: 'support',
                                description: 'Open a premium support ticket',
                        },
                });
        }

        async execute({ ctx }) {
                const activeTicketId = await ctx.client.c.get(supportActiveKey(ctx.user.id));
                if (activeTicketId) {
                        return ctx.reply(supportAlreadyOpenPayload(activeTicketId));
                }

                return ctx.reply(supportCategoryPayload(ctx.user.id));
        }
}

export default new SupportCommand();
