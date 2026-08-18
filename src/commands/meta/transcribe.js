import { Command } from '#command';
import {
        ActionRowBuilder,
        ApplicationCommandType,
        ButtonBuilder,
        ButtonStyle,
        ContainerBuilder,
        MessageFlags,
        SeparatorBuilder,
        SeparatorSpacingSize,
        TextDisplayBuilder,
} from 'discord.js';
import { config } from '#config';
import {
        logger,
        PREMIUM_PRICING_BUTTON_ID,
        transcribeGroqAudio,
} from '#utils';

const WARN_ICON = '<:warn:1538166311916544070>';
const TRANSCRIBE_SAME_MESSAGE_TTL = 120;
const TRANSCRIBE_DAILY_LIMIT = 3;
const TRANSCRIBE_DAILY_TTL = 86400;
const SUPPORTED_EXTENSIONS = new Set([
        'flac',
        'mp3',
        'mp4',
        'mpeg',
        'mpga',
        'm4a',
        'ogg',
        'wav',
        'webm',
]);

const extensionFromName = (name = '') =>
        String(name).split('.').pop()?.toLowerCase() || '';

const isSupportedAttachment = (attachment) => {
        const extension = extensionFromName(attachment?.name);
        if (SUPPORTED_EXTENSIONS.has(extension)) return true;

        const contentType = String(attachment?.contentType || '').toLowerCase();
        return (
                contentType.startsWith('audio/') ||
                contentType === 'video/mp4' ||
                contentType === 'video/webm'
        );
};

const transcribableAttachment = (message) =>
        message?.attachments?.find((attachment) =>
                isSupportedAttachment(attachment),
        ) || null;

const messageLockKey = (userId, messageId) =>
        `transcribe:message:${userId}:${messageId}`;

const dailyLimitKey = (userId) => `transcribe:day:${userId}`;

const payload = (body, footer = null) => {
        const container = new ContainerBuilder()
                .setAccentColor(0xffffff)
                .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(body),
                );

        if (footer) {
                container
                        .addSeparatorComponents(
                                new SeparatorBuilder()
                                        .setSpacing(SeparatorSpacingSize.Small)
                                        .setDivider(true),
                        )
                        .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                        `-# ${footer}`,
                                ),
                        );
        }

        return {
                components: [container],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
                allowedMentions: { parse: [] },
        };
};

const dailyLimitPayload = (userId) => {
        const container = new ContainerBuilder()
                .setAccentColor(0xffffff)
                .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                                '**Daily Transcribe Limit**\n' +
                                        '<:premium:1538553546352361572> You can transcribe 3 messages per day. Try again tomorrow.',
                        ),
                )
                .addSeparatorComponents(
                        new SeparatorBuilder()
                                .setSpacing(SeparatorSpacingSize.Small)
                                .setDivider(true),
                )
                .addActionRowComponents(
                        new ActionRowBuilder().addComponents(
                                new ButtonBuilder()
                                        .setCustomId(
                                                `${PREMIUM_PRICING_BUTTON_ID}:${userId}`,
                                        )
                                        .setLabel('Pricing')
                                        .setEmoji({
                                                name: 'premium',
                                                id: '1538553546352361572',
                                        })
                                        .setStyle(ButtonStyle.Secondary),
                        ),
                );

        return {
                components: [container],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
                allowedMentions: { parse: [] },
        };
};

const formatDuration = (ms) => {
        if (ms < 1000) return `${ms}ms`;
        return `${(ms / 1000).toFixed(1)}s`;
};

const fetchAttachmentBuffer = async (attachment) => {
        const response = await fetch(attachment.url);
        if (!response.ok) {
                throw new Error(`Attachment fetch failed with ${response.status}.`);
        }

        const contentLength = Number(response.headers.get('content-length'));
        if (
                Number.isFinite(contentLength) &&
                contentLength > config.groq.maxTranscriptionBytes
        ) {
                throw new Error('Attachment is too large.');
        }

        const buffer = Buffer.from(await response.arrayBuffer());
        if (buffer.length > config.groq.maxTranscriptionBytes) {
                throw new Error('Attachment is too large.');
        }

        return buffer;
};

const reserveDailyUse = async (client, userId) => {
        const key = dailyLimitKey(userId);
        const count = await client.c.incr(key);
        if (count === 1) await client.c.expire(key, TRANSCRIBE_DAILY_TTL);
        return count;
};

class TranscribeCommand extends Command {
        constructor() {
                super({
                        name: 'transcribe',
                        description: 'Transcribe message audio',
                        cooldown: 15,
                        enabledSlash: true,
                        prefix: false,
                        ephemeral: true,
                        slashData: {
                                name: 'Transcribe',
                                type: ApplicationCommandType.Message,
                        },
                });
        }

        async execute({ ctx }) {
                const message = ctx.interaction.targetMessage;
                const attachment = transcribableAttachment(message);

                if (!message || !attachment) {
                        return ctx.editReply(
                                payload(
                                        `${WARN_ICON} **No supported audio found.**\nAttach audio or video as mp3, mp4, m4a, ogg, wav, webm, flac, mpeg, or mpga.`,
                                ),
                        );
                }

                const lockSet = await ctx.client.c.setnxex(
                        messageLockKey(ctx.user.id, message.id),
                        true,
                        TRANSCRIBE_SAME_MESSAGE_TTL,
                );
                if (!lockSet) {
                        return ctx.editReply(
                                payload(
                                        `${WARN_ICON} **Already transcribed recently.**\nYou can transcribe this same message again in 2 minutes.`,
                                ),
                        );
                }

                const count = await reserveDailyUse(ctx.client, ctx.user.id);
                if (count > TRANSCRIBE_DAILY_LIMIT) {
                        return ctx.editReply(dailyLimitPayload(ctx.user.id));
                }

                await ctx.editReply(
                        payload(
                                '**Transcribe**\nListening and writing it down...',
                                `${TRANSCRIBE_DAILY_LIMIT - count} daily transcribes left`,
                        ),
                );

                const startedAt = Date.now();

                try {
                        const buffer = await fetchAttachmentBuffer(attachment);
                        const result = await transcribeGroqAudio({
                                buffer,
                                filename: attachment.name || `message-${message.id}.mp3`,
                                contentType:
                                        attachment.contentType ||
                                        'application/octet-stream',
                        });

                        return ctx.editReply(
                                payload(
                                        `**Transcription**\n${result.text}`,
                                        `generated in ${formatDuration(Date.now() - startedAt)} using ${result.model}`,
                                ),
                        );
                } catch (error) {
                        logger.error(
                                'Transcribe',
                                `Groq transcription failed: ${error.message}`,
                                error,
                        );

                        return ctx.editReply(
                                payload(
                                        `${WARN_ICON} **I could not transcribe that right now.**\nTry a smaller supported audio file, or try again in a bit.`,
                                ),
                        );
                }
        }
}

export default new TranscribeCommand();
