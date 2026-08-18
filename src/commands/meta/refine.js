import { Command } from '#command';
import { ApplicationCommandOptionType } from 'discord.js';
import {
        createRefineMessageId,
        refineMessageTonePayload,
        storeRefineMessageSource,
} from '#utils';

const previewText = (content) =>
        content.length > 160 ? `${content.slice(0, 157).trim()}...` : content;

class RefineCommand extends Command {
        constructor() {
                super({
                        name: 'refine',
                        description: 'Refine your message into better English',
                        cooldown: 15,
                        enabledSlash: true,
                        prefix: false,
                        ephemeral: true,
                        slashData: {
                                name: 'refine',
                                description:
                                        'Refine your message into better English',
                                options: [
                                        {
                                                type: ApplicationCommandOptionType.String,
                                                name: 'message',
                                                description:
                                                        'The message to improve and translate to English.',
                                                required: true,
                                                min_length: 1,
                                                max_length: 1500,
                                        },
                                ],
                        },
                });
        }

        async execute({ ctx }) {
                const content = ctx.options.getString('message', true).trim();

                if (!content) {
                        return ctx.editReply({
                                content: 'Please send a message to refine.',
                        });
                }

                const sourceId = createRefineMessageId();
                await storeRefineMessageSource(ctx.client, sourceId, {
                        userId: ctx.user.id,
                        content: content.slice(0, 1500),
                });

                return ctx.editReply(
                        refineMessageTonePayload({
                                sourceId,
                                userId: ctx.user.id,
                                preview: previewText(content),
                        }),
                );
        }
}

export default new RefineCommand();
