import { Command } from '#command';
import {
        ApplicationCommandType,
        AttachmentBuilder,
        ContainerBuilder,
        MessageFlags,
        SeparatorBuilder,
        SeparatorSpacingSize,
        TextDisplayBuilder,
} from 'discord.js';
import { logger, readAloudOpenRouter } from '#utils';

const LOADING_EMOJI = '<a:loading:1538534708739051562>';
const READ_ICON = '<:book_icon:1538871828028588042>';
const WARN_ICON = '<:warn:1538166311916544070>';
const MAX_READ_ALOUD_CHARS = 1800;

const payload = (body, accentColor = 0xffffff) => {
        const container = new ContainerBuilder()
                .setAccentColor(accentColor)
                .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(body),
                );

        return {
                components: [container],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
                allowedMentions: { parse: [] },
        };
};

const successPayload = ({ author, chars }) => {
        const container = new ContainerBuilder()
                .setAccentColor(0xffffff)
                .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                                `${READ_ICON} **Read Aloud**\nGenerated an MP3 from **${author}**.`,
                        ),
                )
                .addSeparatorComponents(
                        new SeparatorBuilder()
                                .setSpacing(SeparatorSpacingSize.Small)
                                .setDivider(true),
                )
                .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                                `-# ${chars} character${chars === 1 ? '' : 's'} read aloud.`,
                        ),
                );

        return {
                components: [container],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
                allowedMentions: { parse: [] },
        };
};

class ReadAloudCommand extends Command {
        constructor() {
                super({
                        name: 'readaloud',
                        description: 'Read a message aloud',
                        cooldown: 20,
                        enabledSlash: true,
                        prefix: false,
                        ephemeral: true,
                        slashData: {
                                name: 'read aloud',
                                type: ApplicationCommandType.Message,
                        },
                });
        }

        async execute({ ctx }) {
                const message = ctx.interaction.targetMessage;
                const content = message?.content?.trim();

                if (!message || !content) {
                        return ctx.editReply(
                                payload(
                                        `${WARN_ICON} **No readable text found.**`,
                                ),
                        );
                }

                const input = content.slice(0, MAX_READ_ALOUD_CHARS);
                await ctx.editReply(
                        payload(`${LOADING_EMOJI} **Reading aloud...**`),
                );

                try {
                        const result = await readAloudOpenRouter({ input });
                        const attachment = new AttachmentBuilder(result.audio, {
                                name: `read-aloud-${message.id}.mp3`,
                        });
                        const author =
                                message.author?.tag ||
                                message.author?.username ||
                                'Unknown';

                        return ctx.editReply({
                                ...successPayload({
                                        author,
                                        chars: input.length,
                                }),
                                files: [attachment],
                        });
                } catch (error) {
                        logger.error(
                                'ReadAloud',
                                `Speech request failed: ${error.message}`,
                                error,
                        );

                        return ctx.editReply(
                                payload(
                                        `${WARN_ICON} **I could not read that aloud right now.**\nTry again in a bit.`,
                                ),
                        );
                }
        }
}

export default new ReadAloudCommand();
