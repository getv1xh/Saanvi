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
import { logger, PREMIUM_PRICING_BUTTON_ID, transcribeGroqAudio } from '#utils';

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
const CONTENT_TYPE_EXTENSIONS = new Map([
        ['audio/flac', 'flac'],
        ['audio/mpeg', 'mp3'],
        ['audio/mp3', 'mp3'],
        ['audio/mp4', 'm4a'],
        ['audio/mp4a-latm', 'm4a'],
        ['audio/x-m4a', 'm4a'],
        ['audio/ogg', 'ogg'],
        ['audio/wav', 'wav'],
        ['audio/wave', 'wav'],
        ['audio/x-wav', 'wav'],
        ['audio/webm', 'webm'],
        ['video/mp4', 'mp4'],
        ['video/webm', 'webm'],
]);

const extensionFromName = (name = '') =>
        String(name).split('?')[0].split('.').pop()?.toLowerCase() || '';

const baseContentType = (contentType = '') =>
        String(contentType).split(';')[0].trim().toLowerCase();

const extensionFromContentType = (contentType = '') =>
        CONTENT_TYPE_EXTENSIONS.get(baseContentType(contentType)) || '';

const attachmentExtension = (attachment) => {
        const extension = extensionFromName(attachment?.name);
        if (SUPPORTED_EXTENSIONS.has(extension)) return extension;
        return extensionFromContentType(attachment?.contentType);
};

const filenameForAttachment = (attachment) => {
        const extension = attachmentExtension(attachment) || 'mp3';
        const rawName = String(attachment?.name || `audio.${extension}`)
                .split('?')[0]
                .replace(/[^\w.-]+/g, '-');

        if (SUPPORTED_EXTENSIONS.has(extensionFromName(rawName)))
                return rawName;
        return `${rawName.replace(/\.+$/, '')}.${extension}`;
};

const isSupportedAttachment = (attachment) => {
        return Boolean(attachmentExtension(attachment));
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

class TranscribeUserError extends Error {
        constructor(message, logMessage = message) {
                super(logMessage);
                this.name = 'TranscribeUserError';
                this.userMessage = message;
        }
}

const fetchAttachmentAudio = async (attachment) => {
        const filename = filenameForAttachment(attachment);
        const contentType =
                baseContentType(attachment.contentType) ||
                'application/octet-stream';
        const attachmentSize = Number(attachment.size);

        if (
                Number.isFinite(attachmentSize) &&
                attachmentSize > config.groq.maxTranscriptionBytes
        ) {
                return {
                        url: attachment.url,
                        filename,
                        contentType,
                        size: attachmentSize,
                };
        }

        const response = await fetch(attachment.url);
        if (!response.ok) {
                throw new TranscribeUserError(
                        `${WARN_ICON} **I could not download that audio.**\nPlease try again, or re-upload the voice message and transcribe the fresh copy.`,
                        `Attachment fetch failed with ${response.status}.`,
                );
        }

        const contentLength = Number(response.headers.get('content-length'));
        if (
                Number.isFinite(contentLength) &&
                contentLength > config.groq.maxTranscriptionBytes
        ) {
                return {
                        url: attachment.url,
                        filename,
                        contentType,
                        size: contentLength,
                };
        }

        const buffer = Buffer.from(await response.arrayBuffer());
        if (buffer.length > config.groq.maxTranscriptionBytes) {
                return {
                        url: attachment.url,
                        filename,
                        contentType,
                        size: buffer.length,
                };
        }

        return {
                buffer,
                filename,
                contentType,
                size: buffer.length,
        };
};

const reserveDailyUse = async (client, userId) => {
        const key = dailyLimitKey(userId);
        const ttl = await client.c.ttl(key);
        const count = await client.c.incr(key);
        if (count === 1) {
                await client.c.expire(key, TRANSCRIBE_DAILY_TTL);
        } else if (ttl > 0) {
                await client.c.expire(key, ttl);
        } else {
                await client.c.expire(key, TRANSCRIBE_DAILY_TTL);
        }
        return count;
};

const refundDailyUse = async (client, userId) => {
        const key = dailyLimitKey(userId);

        try {
                const ttl = await client.c.ttl(key);
                const count = await client.c.decr(key);
                if (count <= 0) {
                        await client.c.del(key);
                } else if (ttl > 0) {
                        await client.c.expire(key, ttl);
                } else {
                        await client.c.expire(key, TRANSCRIBE_DAILY_TTL);
                }
        } catch (error) {
                logger.warn(
                        'Transcribe',
                        `Could not refund failed transcribe usage: ${error.message}`,
                        error,
                );
        }
};

const userErrorPayload = (error) => {
        if (error instanceof TranscribeUserError)
                return payload(error.userMessage);

        if (error?.message === 'GROQ_API_KEY is not configured.') {
                return payload(
                        `${WARN_ICON} **Transcribe is not configured yet.**\nAsk the bot owner to set \`GROQ_API_KEY\`.`,
                );
        }

        const status = error?.status;
        const message = String(error?.message || '').toLowerCase();

        if (status === 401 || status === 403) {
                return payload(
                        `${WARN_ICON} **Groq rejected the bot credentials.**\nAsk the bot owner to check the Groq API key.`,
                );
        }

        if (
                status === 413 ||
                message.includes('larger') ||
                message.includes('size')
        ) {
                return payload(
                        `${WARN_ICON} **That audio is too large to transcribe.**\nTry a shorter voice message or a smaller supported audio file.`,
                );
        }

        if (
                status === 400 &&
                (message.includes('format') ||
                        message.includes('extension') ||
                        message.includes('file type'))
        ) {
                return payload(
                        `${WARN_ICON} **That audio format is not supported.**\nUse mp3, mp4, m4a, ogg, wav, webm, flac, mpeg, or mpga.`,
                );
        }

        if (status === 429 || message.includes('rate limit')) {
                return payload(
                        `${WARN_ICON} **Transcribe is rate limited right now.**\nPlease try again in a bit.`,
                );
        }

        return payload(
                `${WARN_ICON} **I could not transcribe that right now.**\nTry a smaller supported audio file, or try again in a bit.`,
        );
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
                        await refundDailyUse(ctx.client, ctx.user.id);
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
                        const audio = await fetchAttachmentAudio(attachment);
                        const result = await transcribeGroqAudio({
                                buffer: audio.buffer,
                                url: audio.url,
                                filename:
                                        audio.filename ||
                                        `message-${message.id}.mp3`,
                                contentType: audio.contentType,
                        });

                        return ctx.editReply(
                                payload(
                                        `**Transcription**\n${result.text}`,
                                        `generated in ${formatDuration(Date.now() - startedAt)}`,
                                ),
                        );
                } catch (error) {
                        await refundDailyUse(ctx.client, ctx.user.id);
                        logger.error(
                                'Transcribe',
                                `Groq transcription failed: ${error.message}`,
                                error,
                        );

                        return ctx.editReply(userErrorPayload(error));
                }
        }
}

export default new TranscribeCommand();
