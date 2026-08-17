import { Command } from '#command';
import {
        ApplicationCommandType,
        AttachmentBuilder,
        ContainerBuilder,
        MessageFlags,
        TextDisplayBuilder,
} from 'discord.js';
import { logger, readAloudOpenRouter } from '#utils';

const READ_ICON = '<:book_icon:1538871828028588042>';
const WARN_ICON = '<:warn:1538166311916544070>';
const MAX_READ_ALOUD_CHARS = 1800;

const cleanSpeechText = (message) =>
        String(message.cleanContent || message.content || '')
                .replace(/<a?:([a-zA-Z0-9_]+):\d+>/g, ' ')
                .replace(/\p{Extended_Pictographic}|\uFE0F/gu, ' ')
                .replace(/https?:\/\/\S+/g, ' link ')
                .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
                .replace(/`{1,3}([^`]*)`{1,3}/g, '$1')
                .replace(/[*_~|>#]/g, ' ')
                .replace(/^\s*[-+]\s+/gm, '')
                .replace(/\s+/g, ' ')
                .trim()
                .slice(0, MAX_READ_ALOUD_CHARS);

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
                const input = message ? cleanSpeechText(message) : '';

                if (!message || !input) {
                        return ctx.editReply(
                                payload(
                                        `${WARN_ICON} **No readable text found.**`,
                                ),
                        );
                }

                try {
                        const result = await readAloudOpenRouter({ input });
                        const filename = `read-aloud-${message.id}.mp3`;
                        const attachment = new AttachmentBuilder(result.audio, {
                                name: filename,
                        });

                        return ctx.editReply({
                                content: `${READ_ICON} Done.`,
                                components: [],
                                allowedMentions: { parse: [] },
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
