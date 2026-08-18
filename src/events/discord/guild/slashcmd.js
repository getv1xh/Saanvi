import {
        InteractionType,
        ComponentType,
        ContainerBuilder,
        TextDisplayBuilder,
        SeparatorBuilder,
        SeparatorSpacingSize,
        MessageFlags,
        AttachmentBuilder,
        ActionRowBuilder,
        ButtonBuilder,
        ButtonStyle,
        ModalBuilder,
        TextInputBuilder,
        TextInputStyle,
} from 'discord.js';
import { config } from '#config';
import {
        validateCommand,
        canBotSendMessages,
        canBypassPremiumRequestLimit,
        canBypassPremium,
        isOwner,
        logger,
        PREMIUM_COMPONENT_PREFIX,
        PREMIUM_PRICING_BUTTON_ID,
        premiumPaymentPayload,
        premiumPlanPayload,
        premiumPromptOptions,
        premiumPricingPayload,
        SUPPORT_CATEGORY_SELECT_PREFIX,
        SUPPORT_CLOSE_PREFIX,
        SUPPORT_MESSAGE_INPUT_ID,
        SUPPORT_MODAL_PREFIX,
        SUPPORT_REPLY_MESSAGE_INPUT_ID,
        SUPPORT_REPLY_MODAL_PREFIX,
        SUPPORT_REPLY_PREFIX,
        SUPPORT_TICKET_TTL_SECONDS,
        ASK_REPLY_MESSAGE_INPUT_ID,
        ASK_REPLY_MODAL_PREFIX,
        ASK_REPLY_PREFIX,
        askConversationKey,
        askReplyModal,
        askResponsePayload,
        askOpenRouter,
        parseStoredAskConversation,
        scheduleAskReplyButtonRemoval,
        storeAskConversation,
        SUGGEST_REPLY_CHANGES_INPUT_ID,
        SUGGEST_REPLY_CUSTOM_MODAL_PREFIX,
        SUGGEST_REPLY_CUSTOM_TONE_INPUT_ID,
        SUGGEST_REPLY_RETRY_MODAL_PREFIX,
        SUGGEST_REPLY_RETRY_PREFIX,
        SUGGEST_REPLY_TONE_PREFIX,
        REFINE_MESSAGE_CHANGES_INPUT_ID,
        REFINE_MESSAGE_CUSTOM_MODAL_PREFIX,
        REFINE_MESSAGE_CUSTOM_TONE_INPUT_ID,
        REFINE_MESSAGE_RETRY_MODAL_PREFIX,
        REFINE_MESSAGE_RETRY_PREFIX,
        REFINE_MESSAGE_TONE_PREFIX,
        EXPLAIN_MESSAGE_CHANGES_INPUT_ID,
        EXPLAIN_MESSAGE_RETRY_MODAL_PREFIX,
        EXPLAIN_MESSAGE_RETRY_PREFIX,
        BOOKMARK_CREATE_MODAL_PREFIX,
        BOOKMARK_CREATE_PREFIX,
        BOOKMARK_DELETE_CANCEL_PREFIX,
        BOOKMARK_DELETE_CONFIRM_PREFIX,
        BOOKMARK_DELETE_PREFIX,
        BOOKMARK_LIST_SELECT_PREFIX,
        BOOKMARK_NAME_INPUT_ID,
        BOOKMARK_PAGE_PREFIX,
        BOOKMARK_SAVE_SELECT_PREFIX,
        bookmarkCreateCollectionModal,
        bookmarkDeleteConfirmPayload,
        bookmarkDeletedPayload,
        bookmarkExpiredPayload,
        bookmarkLimitPayload,
        bookmarkSavedPayload,
        bookmarksCollectionMenuPayload,
        bookmarksCollectionPagePayload,
        bookmarkSourceKey,
        parseStoredBookmarkSource,
        parseStoredSuggestReplySource,
        scheduleSuggestReplyButtonRemoval,
        storeSuggestReplySource,
        suggestReplyCustomToneModal,
        suggestReplyGeneratedPayload,
        suggestReplyOpenRouter,
        suggestReplyRetryModal,
        suggestReplySourceKey,
        parseStoredRefineMessageSource,
        refineMessageCustomToneModal,
        refineMessageGeneratedPayload,
        refineMessageOpenRouter,
        refineMessageRetryModal,
        refineMessageSourceKey,
        scheduleRefineMessageButtonRemoval,
        storeRefineMessageSource,
        explainMessageOpenRouter,
        explainMessagePayload,
        explainMessageRetryModal,
        explainMessageSourceKey,
        parseStoredExplainMessageSource,
        scheduleExplainMessageButtonRemoval,
        storeExplainMessageSource,
        TRANSLATE_MESSAGE_CHANGES_INPUT_ID,
        TRANSLATE_MESSAGE_LANGUAGE_INPUT_ID,
        TRANSLATE_MESSAGE_LANGUAGE_MODAL_PREFIX,
        TRANSLATE_MESSAGE_LANGUAGE_PREFIX,
        TRANSLATE_MESSAGE_RETRY_MODAL_PREFIX,
        TRANSLATE_MESSAGE_RETRY_PREFIX,
        parseStoredTranslateMessageSource,
        scheduleTranslateMessageButtonRemoval,
        storeTranslateMessageSource,
        translateMessageLanguageModal,
        translateMessageOpenRouter,
        translateMessagePayload,
        translateMessageRetryModal,
        translateMessageSourceKey,
        createSupportTicketId,
        supportActiveKey,
        supportAlreadyOpenPayload,
        supportClosedUserPayload,
        supportModal,
        supportReplyModal,
        supportReplyUserPayload,
        supportSubmittedPayload,
        supportTicketKey,
        supportUserReplyOwnerPayload,
        supportOwnerTicketPayload,
} from '#utils';
import { CommandContext } from '#context';
import { db } from '#dbManager';
import { emoji } from '#emoji';
import QRCode from 'qrcode';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const asset = (file) => path.join(__dirname, '../../../assets', file);

const QR_FRAMES = [
        {
                buffer: fs.readFileSync(asset('qr_frame2.jpg')),
                box: { left: 135, top: 183, right: 602, bottom: 593 },
                pad: 18,
        },
];

const errorContainer = new ContainerBuilder();
const errorTitle = new TextDisplayBuilder();
const errorSeparator = new SeparatorBuilder()
        .setSpacing(SeparatorSpacingSize.Small)
        .setDivider(true);
const errorDescription = new TextDisplayBuilder();

const publicEditOptions = (options) => ({
        ...options,
        flags: options.flags
                ? options.flags & ~MessageFlags.Ephemeral
                : options.flags,
});

const sendError = async (
        interaction,
        title,
        description,
        forceEphemeral = false,
) => {
        if (!interaction || !title || !description) return;

        errorContainer.components.length = 0;
        errorContainer.setAccentColor(config.colors?.error || 0xed4245);
        errorTitle.data.content = `## ${emoji?.cross || '❌'} ${title}`;
        errorDescription.data.content = description;
        errorContainer
                .addTextDisplayComponents(errorTitle)
                .addSeparatorComponents(errorSeparator)
                .addTextDisplayComponents(errorDescription);

        try {
                const canSend =
                        interaction.channel && interaction.inGuild()
                                ? canBotSendMessages(interaction.channel)
                                : true;
                const flags =
                        !canSend || forceEphemeral
                                ? MessageFlags.IsComponentsV2 |
                                  MessageFlags.Ephemeral
                                : MessageFlags.IsComponentsV2;

                const reply = { components: [errorContainer], flags };

                if (interaction.deferred) {
                        await interaction
                                .editReply(publicEditOptions(reply))
                                .catch(() => {});
                } else if (interaction.replied) {
                        await interaction.followUp(reply).catch(() => {});
                } else {
                        await interaction.reply(reply).catch(() => {});
                }
        } catch (error) {
                logger.error(
                        'InteractionCreate',
                        `Failed to send error: ${error.message}`,
                );
        }
};

const sendCooldown = async (interaction, cooldown) => {
        if (!interaction || !cooldown) return;

        try {
                const timestamp = Math.floor((Date.now() + cooldown) / 1000);

                let content = `**Cooldown** - Ends <t:${timestamp}:R>`;

                const cooldownContainer = new ContainerBuilder();
                cooldownContainer.setAccentColor(
                        config.colors?.warn || 0xfee75c,
                );
                cooldownContainer.addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(content),
                );
                const reply = {
                        components: [cooldownContainer],
                        flags:
                                MessageFlags.IsComponentsV2 |
                                MessageFlags.Ephemeral,
                };

                if (interaction.deferred) {
                        await interaction
                                .editReply(publicEditOptions(reply))
                                .catch(() => {});
                } else if (interaction.replied) {
                        await interaction.followUp(reply).catch(() => {});
                } else {
                        await interaction.reply(reply).catch(() => {});
                }
        } catch (error) {
                logger.error(
                        'InteractionCreate',
                        `Failed to send cooldown: ${error.message}`,
                );
        }
};

const respond = async (interaction, options) => {
        if (interaction.deferred)
                return interaction.editReply(publicEditOptions(options));
        if (interaction.replied) return interaction.followUp(options);
        return interaction.reply(options);
};

const isUnknownInteraction = (error) =>
        error?.code === 10062 || error?.rawError?.code === 10062;

const deferInteraction = async (interaction, options = {}) => {
        if (!interaction || interaction.deferred || interaction.replied)
                return true;

        try {
                await interaction.deferReply(options);
                return true;
        } catch (error) {
                if (isUnknownInteraction(error)) {
                        logger.warn(
                                'InteractionCreate',
                                `Interaction expired before defer: /${interaction.commandName}`,
                        );
                        return false;
                }
                throw error;
        }
};

const getCommandFile = (interaction, client) => {
        if (!interaction || !client || !client.commandHandler) return null;

        try {
                const { commandName } = interaction;
                const subCommandGroup =
                        interaction.options?.getSubcommandGroup(false);
                const subCommandName =
                        interaction.options?.getSubcommand(false);

                if (subCommandGroup && subCommandName) {
                        const cmd = client.commandHandler.slashCommandFiles.get(
                                `${commandName}:${subCommandGroup}:${subCommandName}`,
                        );
                        if (cmd) return cmd;
                }
                if (subCommandName) {
                        const cmd = client.commandHandler.slashCommandFiles.get(
                                `${commandName}:${subCommandName}`,
                        );
                        if (cmd) return cmd;
                }
                return client.commandHandler.slashCommandFiles.get(commandName);
        } catch (error) {
                logger.error(
                        'InteractionCreate',
                        `Error getting command file: ${error.message}`,
                );
                return null;
        }
};

const handleChatInputCommand = async (interaction, client) => {
        if (!interaction || !client) return;

        try {
                if (!interaction.user) {
                        return sendError(
                                interaction,
                                'Invalid Context',
                                'Unable to process this interaction.',
                                true,
                        );
                }

                const inGuild = interaction.inGuild();
                const isMessageContext =
                        interaction.isMessageContextMenuCommand?.() || false;
                const userId = interaction.user.id;
                const guildId = interaction.guild?.id ?? null;
                const channelId = interaction.channel?.id ?? null;

                if (
                        inGuild &&
                        !isMessageContext &&
                        interaction.channel &&
                        !canBotSendMessages(interaction.channel)
                ) {
                        return sendError(
                                interaction,
                                'Missing Bot Permissions',
                                "I don't have permission to send messages in this channel. Please grant me the **Send Messages** and **View Channel** permissions before using commands.",
                                true,
                        );
                }

                const commandToExecute = getCommandFile(interaction, client);
                if (!commandToExecute) {
                        logger.warn(
                                'InteractionCreate',
                                `No command file found for: /${interaction.commandName}`,
                        );
                        return sendError(
                                interaction,
                                'Command Error',
                                'This command seems to be outdated or improperly configured.',
                                true,
                        );
                }

                const deferOptions = isMessageContext || commandToExecute.ephemeral
                        ? { flags: MessageFlags.Ephemeral }
                        : {};
                const deferred = await deferInteraction(
                        interaction,
                        deferOptions,
                );
                if (!deferred) return;

                const shouldCheckPremium =
                        config.premium.enabled &&
                        !canBypassPremium(commandToExecute) &&
                        !isOwner(userId);

                let isUserBlacklisted = false;
                let isGuildBlacklisted = false;
                let isChannelIgnored = false;

                try {
                        [
                                isUserBlacklisted,
                                isGuildBlacklisted,
                                isChannelIgnored,
                        ] = await Promise.all([
                                db.blacklist
                                        ?.checkBlacklist(userId)
                                        .catch(() => false) ?? false,
                                inGuild && guildId
                                        ? (db.blacklist
                                                  ?.checkBlacklist(guildId)
                                                  .catch(() => false) ?? false)
                                        : false,
                                inGuild && guildId && channelId
                                        ? (db.guild
                                                  ?.isChannelIgnored(
                                                          guildId,
                                                          channelId,
                                                  )
                                                  .catch(() => false) ?? false)
                                        : false,
                        ]);
                } catch (error) {
                        logger.error(
                                'InteractionCreate',
                                `Database check failed: ${error.message}`,
                        );
                }

                if (isUserBlacklisted || isGuildBlacklisted) {
                        return respond(interaction, {
                                content: 'You or this server is blacklisted.',
                                flags: MessageFlags.Ephemeral,
                        }).catch(() => {});
                }

                if (isChannelIgnored) {
                        return respond(interaction, {
                                content: '**Ignored Channel** Commands are disabled in this channel.',
                                flags: MessageFlags.Ephemeral,
                        }).catch(() => {});
                }

                if (
                        shouldCheckPremium &&
                        !(await db.user.isPremium(userId).catch(() => false))
                ) {
                        return respond(
                                interaction,
                                premiumPromptOptions(userId),
                        ).catch(() => {});
                }

                const cooldownScope = guildId ?? userId;
                if (commandToExecute.cooldown && client.commandHandler) {
                        try {
                                const cooldown =
                                        await client.commandHandler.isOnCooldown(
                                                commandToExecute,
                                                userId,
                                                cooldownScope,
                                        );
                                if (cooldown) {
                                        return await sendCooldown(
                                                interaction,
                                                cooldown,
                                        );
                                }
                                await client.commandHandler.setCooldown(
                                        commandToExecute,
                                        userId,
                                        cooldownScope,
                                );
                        } catch (error) {
                                logger.error(
                                        'InteractionCreate',
                                        `Cooldown check failed: ${error.message}`,
                                );
                        }
                }

                try {
                        const ctx = new CommandContext({ client, interaction });
                        const permissionValidation = await validateCommand(
                                ctx,
                                commandToExecute,
                        );
                        if (!permissionValidation.valid) {
                                return sendError(
                                        interaction,
                                        permissionValidation.error?.title ||
                                                'Permission Error',
                                        permissionValidation.error
                                                ?.description ||
                                                'You cannot use this command.',
                                        true,
                                );
                        }
                        await commandToExecute.execute({ ctx });
                } catch (error) {
                        if (isUnknownInteraction(error)) {
                                logger.warn(
                                        'InteractionCreate',
                                        `Interaction expired while executing: ${commandToExecute.slashData?.name || 'unknown'}`,
                                );
                                return;
                        }

                        logger.error(
                                'InteractionCreate',
                                `Error executing: ${commandToExecute.slashData?.name || 'unknown'}`,
                                error,
                        );
                        await sendError(
                                interaction,
                                'Command Error',
                                'An unexpected error occurred while running the command.',
                                true,
                        );
                }
        } catch (error) {
                if (isUnknownInteraction(error)) {
                        logger.warn(
                                'InteractionCreate',
                                `Expired interaction ignored: /${interaction?.commandName || 'unknown'}`,
                        );
                        return;
                }

                logger.error(
                        'InteractionCreate',
                        `Fatal error in command handler: ${error.message}`,
                        error,
                );
        }
};

const handleAutocomplete = async (interaction, client) => {
        if (!interaction || !client) return;

        try {
                const commandToExecute = getCommandFile(interaction, client);
                if (!commandToExecute?.autocomplete) return;
                await commandToExecute.autocomplete({ interaction, client });
        } catch (error) {
                logger.error(
                        'InteractionCreate',
                        `Autocomplete error for '${interaction.commandName}': ${error.message}`,
                );
        }
};

const handleQrButton = async (interaction) => {
        try {
                await interaction.deferUpdate();

                const address = interaction.customId.slice('addy_qr:'.length);

                const frame =
                        QR_FRAMES[Math.floor(Math.random() * QR_FRAMES.length)];

                const boxW = frame.box.right - frame.box.left;
                const boxH = frame.box.bottom - frame.box.top;
                const qrSize = Math.min(boxW, boxH) - frame.pad * 2;

                const qrBuf = await QRCode.toBuffer(address, {
                        type: 'png',
                        width: qrSize,
                        margin: 1,
                        color: { dark: '#000000', light: '#00000000' },
                });

                const offsetX =
                        frame.box.left + Math.floor((boxW - qrSize) / 2);
                const offsetY = frame.box.top + Math.floor((boxH - qrSize) / 2);

                const compositeBuf = await sharp(frame.buffer)
                        .composite([
                                { input: qrBuf, top: offsetY, left: offsetX },
                        ])
                        .png()
                        .toBuffer();

                const attachment = new AttachmentBuilder(compositeBuf, {
                        name: 'qr.png',
                });

                await interaction.editReply({ components: [] });
                await interaction.followUp({ files: [attachment] });
        } catch (error) {
                logger.error(
                        'InteractionCreate',
                        `QR generation error: ${error.message}`,
                );
                await interaction
                        .followUp({ content: 'Failed to generate QR code.' })
                        .catch(() => {});
        }
};

const handleUpiQrButton = async (interaction) => {
        try {
                await interaction.deferUpdate();

                const upiId = interaction.customId.slice('upi_qr:'.length);
                const upiUrl = `upi://pay?pa=${encodeURIComponent(upiId)}`;

                const frame =
                        QR_FRAMES[Math.floor(Math.random() * QR_FRAMES.length)];

                const boxW = frame.box.right - frame.box.left;
                const boxH = frame.box.bottom - frame.box.top;
                const qrSize = Math.min(boxW, boxH) - frame.pad * 2;

                const qrBuf = await QRCode.toBuffer(upiUrl, {
                        type: 'png',
                        width: qrSize,
                        margin: 1,
                        color: { dark: '#000000', light: '#00000000' },
                });

                const offsetX =
                        frame.box.left + Math.floor((boxW - qrSize) / 2);
                const offsetY = frame.box.top + Math.floor((boxH - qrSize) / 2);

                const compositeBuf = await sharp(frame.buffer)
                        .composite([
                                { input: qrBuf, top: offsetY, left: offsetX },
                        ])
                        .png()
                        .toBuffer();

                const attachment = new AttachmentBuilder(compositeBuf, {
                        name: 'qr.png',
                });

                await interaction.editReply({ components: [] });
                await interaction.followUp({ files: [attachment] });
        } catch (error) {
                logger.error(
                        'InteractionCreate',
                        `UPI QR generation error: ${error.message}`,
                );
                await interaction
                        .followUp({ content: 'Failed to generate QR code.' })
                        .catch(() => {});
        }
};

const handlePaypalQrButton = async (interaction) => {
        try {
                await interaction.deferUpdate();

                const username = interaction.customId.slice(
                        'paypal_qr:'.length,
                );
                const paypalUrl = `https://paypal.me/${username.replace(/^@/, '')}`;

                const frame =
                        QR_FRAMES[Math.floor(Math.random() * QR_FRAMES.length)];

                const boxW = frame.box.right - frame.box.left;
                const boxH = frame.box.bottom - frame.box.top;
                const qrSize = Math.min(boxW, boxH) - frame.pad * 2;

                const qrBuf = await QRCode.toBuffer(paypalUrl, {
                        type: 'png',
                        width: qrSize,
                        margin: 1,
                        color: { dark: '#000000', light: '#00000000' },
                });

                const offsetX =
                        frame.box.left + Math.floor((boxW - qrSize) / 2);
                const offsetY = frame.box.top + Math.floor((boxH - qrSize) / 2);

                const compositeBuf = await sharp(frame.buffer)
                        .composite([
                                { input: qrBuf, top: offsetY, left: offsetX },
                        ])
                        .png()
                        .toBuffer();

                const attachment = new AttachmentBuilder(compositeBuf, {
                        name: 'qr.png',
                });

                await interaction.editReply({ components: [] });
                await interaction.followUp({ files: [attachment] });
        } catch (error) {
                logger.error(
                        'InteractionCreate',
                        `PayPal QR generation error: ${error.message}`,
                );
                await interaction
                        .followUp({ content: 'Failed to generate QR code.' })
                        .catch(() => {});
        }
};

const handlePremiumPricingButton = async (interaction) => {
        try {
                const [, , ownerId] = interaction.customId.split(':');
                if (
                        ownerId &&
                        ownerId !== '0' &&
                        ownerId !== interaction.user.id
                ) {
                        return interaction.reply({
                                content: 'This premium menu belongs to someone else.',
                                flags: MessageFlags.Ephemeral,
                        });
                }

                await interaction.update(
                        premiumPricingPayload(interaction.user.id),
                );
        } catch (error) {
                logger.error(
                        'InteractionCreate',
                        `Premium pricing button failed: ${error.message}`,
                        error,
                );
        }
};

const paymentLabels = {
        coingate: 'Coingate Gift Card',
        usdt_pol: 'USDT POL Chain',
        usdt_bep20: 'USDT BEP20 Chain',
        solana: 'Solana',
        litecoin: 'Litecoin',
};

const planLabels = {
        user: 'User Premium',
        server: 'Server Premium',
};

const FOLLOW_UP_MESSAGE_INPUT_ID = 'premium_follow_up_message';
const PREMIUM_SUPPORT_MESSAGE_INPUT_ID = 'premium_support_message';
const DOTS_EMOJI = '<:dots:1538555958228164759>';
const CHAT_EMOJI = '<a:CHAT:1538828248308387896>';
const LOADING_EMOJI = '<a:loading:1538534708739051562>';

const premiumCustomId = (...parts) =>
        ['premium', ...parts].filter(Boolean).join(':');

const premiumPlanPaymentText = (plan, method) =>
        method === 'support'
                ? `> ${DOTS_EMOJI} Plan: ${planLabels[plan] || plan}\n` +
                  `> ${DOTS_EMOJI} Type: Premium Support`
                : `> ${DOTS_EMOJI} Plan: ${planLabels[plan] || plan}\n` +
                  `> ${DOTS_EMOJI}Payment: ${paymentLabels[method] || method}`;

const quoteBlock = (value) =>
        String(value || '')
                .split('\n')
                .map((line) => `> ${line || ' '}`)
                .join('\n');

const formatAskDuration = (ms) => {
        if (ms < 1000) return `${ms}ms`;
        return `${(ms / 1000).toFixed(1)}s`;
};

const askOpenRouterErrorMessage = () =>
        'I could not answer that right now. Try again in a bit.';

const parseAskReplyParts = (customId) => {
        const [, action, conversationId, userId] = customId.split(':');
        if (action !== 'reply' && action !== 'replymodal') return null;
        return { action, conversationId, userId };
};

const showAskReplyModal = async (interaction) => {
        const parts = parseAskReplyParts(interaction.customId);
        if (!parts || parts.action !== 'reply') return;

        const { conversationId, userId } = parts;

        if (interaction.user.id !== userId) {
                return interaction.reply({
                        content: 'This ask reply belongs to someone else.',
                        flags: MessageFlags.Ephemeral,
                });
        }

        const conversation = parseStoredAskConversation(
                await interaction.client.c.get(
                        askConversationKey(conversationId),
                ),
        );

        if (!conversation) {
                return interaction.reply({
                        content: 'This ask conversation has expired.',
                        flags: MessageFlags.Ephemeral,
                });
        }

        return interaction.showModal(askReplyModal(conversationId, userId));
};

const handleAskReplyModal = async (interaction) => {
        const parts = parseAskReplyParts(interaction.customId);
        if (!parts || parts.action !== 'replymodal') return;

        const { conversationId, userId } = parts;

        if (interaction.user.id !== userId) {
                return interaction.reply({
                        content: 'This ask reply belongs to someone else.',
                        flags: MessageFlags.Ephemeral,
                });
        }

        const message = interaction.fields
                .getTextInputValue(ASK_REPLY_MESSAGE_INPUT_ID)
                ?.trim();
        if (!message) {
                return interaction.reply({
                        content: 'Please enter a reply.',
                        flags: MessageFlags.Ephemeral,
                });
        }

        const conversation = parseStoredAskConversation(
                await interaction.client.c.get(
                        askConversationKey(conversationId),
                ),
        );

        if (!conversation || conversation.userId !== userId) {
                return interaction.reply({
                        content: 'This ask conversation has expired.',
                        flags: MessageFlags.Ephemeral,
                });
        }

        const startedAt = Date.now();
        await interaction.deferReply();

        try {
                const messages = [
                        ...(conversation.messages || []),
                        { role: 'user', content: message },
                ];
                const result = await askOpenRouter({
                        messages,
                        useWeb: !!conversation.useWeb,
                });
                const duration = formatAskDuration(Date.now() - startedAt);
                const payloadOptions = {
                        body: result.answer,
                        footer: `reply generated in ${duration}`,
                        conversationId,
                        userId,
                        includeReplyButton: true,
                };

                await storeAskConversation(interaction.client, conversationId, {
                        ...conversation,
                        messages: [
                                ...messages,
                                {
                                        role: 'assistant',
                                        content: result.answer,
                                },
                        ],
                });

                const reply = await interaction.editReply(
                        askResponsePayload(payloadOptions),
                );
                scheduleAskReplyButtonRemoval(reply, payloadOptions);
                return reply;
        } catch (error) {
                logger.error(
                        'Ask',
                        `OpenRouter follow-up failed: ${error.message}`,
                        error,
                );
                return interaction.editReply(
                        askResponsePayload({
                                body: askOpenRouterErrorMessage(),
                        }),
                );
        }
};

const parseSuggestReplyParts = (customId) => {
        const [, action, sourceId, userId] = customId.split(':');
        if (!['tone', 'retry', 'custommodal', 'retrymodal'].includes(action)) {
                return null;
        }
        return { action, sourceId, userId };
};

const getSuggestReplySource = async (interaction, sourceId, userId) => {
        const source = parseStoredSuggestReplySource(
                await interaction.client.c.get(suggestReplySourceKey(sourceId)),
        );

        if (!source || source.userId !== userId) return null;
        return source;
};

const suggestReplyErrorMessage = () =>
        'I could not write a reply right now. Try again in a bit.';

const runSuggestReplyGeneration = async ({
        interaction,
        sourceId,
        userId,
        source,
        tone,
        customTone = '',
        changeRequest = '',
        previousReply = '',
        updateOriginal = false,
}) => {
        const startedAt = Date.now();

        const thinkingPayload = suggestReplyGeneratedPayload({
                answer: `**Writing a reply............**`,
        });

        if (updateOriginal) {
                await interaction.update(thinkingPayload);
        } else if (interaction.deferred) {
                await interaction.editReply(thinkingPayload);
        }

        try {
                const result = await suggestReplyOpenRouter({
                        sourceMessage: source,
                        tone,
                        customTone,
                        changeRequest,
                        previousReply,
                });
                const duration = formatAskDuration(Date.now() - startedAt);

                await storeSuggestReplySource(interaction.client, sourceId, {
                        ...source,
                        tone,
                        customTone,
                        previousReply: result.answer,
                });

                const payloadOptions = {
                        answer: result.answer,
                        suggestions: result.suggestions,
                        footer: `generated in ${duration}`,
                        sourceId,
                        userId,
                        includeRetryButton: true,
                };
                const reply = await interaction.editReply(
                        suggestReplyGeneratedPayload(payloadOptions),
                );
                scheduleSuggestReplyButtonRemoval(reply, payloadOptions);
                return reply;
        } catch (error) {
                logger.error(
                        'SuggestReply',
                        `OpenRouter request failed: ${error.message}`,
                        error,
                );
                return interaction.editReply(
                        suggestReplyGeneratedPayload({
                                answer: suggestReplyErrorMessage(),
                        }),
                );
        }
};

const handleSuggestReplyToneSelect = async (interaction) => {
        const parts = parseSuggestReplyParts(interaction.customId);
        if (!parts || parts.action !== 'tone') return;

        const { sourceId, userId } = parts;
        if (interaction.user.id !== userId) {
                return interaction.reply({
                        content: 'This reply suggestion menu belongs to someone else.',
                        flags: MessageFlags.Ephemeral,
                });
        }

        const source = await getSuggestReplySource(
                interaction,
                sourceId,
                userId,
        );
        if (!source) {
                return interaction.reply({
                        content: 'This reply suggestion has expired.',
                        flags: MessageFlags.Ephemeral,
                });
        }

        const tone = interaction.values?.[0];
        if (tone === 'custom') {
                return interaction.showModal(
                        suggestReplyCustomToneModal(sourceId, userId),
                );
        }

        return runSuggestReplyGeneration({
                interaction,
                sourceId,
                userId,
                source,
                tone: tone || 'normal',
                updateOriginal: true,
        });
};

const showSuggestReplyRetryModal = async (interaction) => {
        const parts = parseSuggestReplyParts(interaction.customId);
        if (!parts || parts.action !== 'retry') return;

        const { sourceId, userId } = parts;
        if (interaction.user.id !== userId) {
                return interaction.reply({
                        content: 'This retry button belongs to someone else.',
                        flags: MessageFlags.Ephemeral,
                });
        }

        const source = await getSuggestReplySource(
                interaction,
                sourceId,
                userId,
        );
        if (!source) {
                return interaction.reply({
                        content: 'This reply suggestion has expired.',
                        flags: MessageFlags.Ephemeral,
                });
        }

        return interaction.showModal(suggestReplyRetryModal(sourceId, userId));
};

const handleSuggestReplyCustomToneModal = async (interaction) => {
        const parts = parseSuggestReplyParts(interaction.customId);
        if (!parts || parts.action !== 'custommodal') return;

        const { sourceId, userId } = parts;
        if (interaction.user.id !== userId) {
                return interaction.reply({
                        content: 'This custom tone form belongs to someone else.',
                        flags: MessageFlags.Ephemeral,
                });
        }

        const source = await getSuggestReplySource(
                interaction,
                sourceId,
                userId,
        );
        if (!source) {
                return interaction.reply({
                        content: 'This reply suggestion has expired.',
                        flags: MessageFlags.Ephemeral,
                });
        }

        const customTone = interaction.fields
                .getTextInputValue(SUGGEST_REPLY_CUSTOM_TONE_INPUT_ID)
                ?.trim();
        if (!customTone) {
                return interaction.reply({
                        content: 'Please enter a tone.',
                        flags: MessageFlags.Ephemeral,
                });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        return runSuggestReplyGeneration({
                interaction,
                sourceId,
                userId,
                source,
                tone: 'custom',
                customTone,
        });
};

const handleSuggestReplyRetryModal = async (interaction) => {
        const parts = parseSuggestReplyParts(interaction.customId);
        if (!parts || parts.action !== 'retrymodal') return;

        const { sourceId, userId } = parts;
        if (interaction.user.id !== userId) {
                return interaction.reply({
                        content: 'This retry form belongs to someone else.',
                        flags: MessageFlags.Ephemeral,
                });
        }

        const source = await getSuggestReplySource(
                interaction,
                sourceId,
                userId,
        );
        if (!source) {
                return interaction.reply({
                        content: 'This reply suggestion has expired.',
                        flags: MessageFlags.Ephemeral,
                });
        }

        const changeRequest = interaction.fields
                .getTextInputValue(SUGGEST_REPLY_CHANGES_INPUT_ID)
                ?.trim();
        if (!changeRequest) {
                return interaction.reply({
                        content: 'Please describe what to change.',
                        flags: MessageFlags.Ephemeral,
                });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        return runSuggestReplyGeneration({
                interaction,
                sourceId,
                userId,
                source,
                tone: source.tone || 'normal',
                customTone: source.customTone || '',
                changeRequest,
                previousReply: source.previousReply || '',
        });
};

const parseRefineMessageParts = (customId) => {
        const [, action, sourceId, userId] = customId.split(':');
        if (!['tone', 'retry', 'custommodal', 'retrymodal'].includes(action)) {
                return null;
        }
        return { action, sourceId, userId };
};

const getRefineMessageSource = async (interaction, sourceId, userId) => {
        const source = parseStoredRefineMessageSource(
                await interaction.client.c.get(
                        refineMessageSourceKey(sourceId),
                ),
        );

        if (!source || source.userId !== userId) return null;
        return source;
};

const refineMessageErrorMessage = () =>
        'I could not refine that right now. Try again in a bit.';

const runRefineMessageGeneration = async ({
        interaction,
        sourceId,
        userId,
        source,
        tone,
        customTone = '',
        changeRequest = '',
        previousRefinement = '',
        updateOriginal = false,
}) => {
        const startedAt = Date.now();
        const thinkingPayload = refineMessageGeneratedPayload({
                status: 'Refining the message...',
        });

        if (updateOriginal) {
                await interaction.update(thinkingPayload);
        } else if (interaction.deferred) {
                await interaction.editReply(thinkingPayload);
        }

        try {
                const result = await refineMessageOpenRouter({
                        sourceMessage: source,
                        tone,
                        customTone,
                        changeRequest,
                        previousRefinement,
                });
                const duration = formatAskDuration(Date.now() - startedAt);

                await storeRefineMessageSource(interaction.client, sourceId, {
                        ...source,
                        tone,
                        customTone,
                        previousRefinement: result.answer,
                });

                const payloadOptions = {
                        answer: result.answer,
                        refinements: result.refinements,
                        footer: `generated in ${duration}`,
                        sourceId,
                        userId,
                        includeRetryButton: true,
                };
                const reply = await interaction.editReply(
                        refineMessageGeneratedPayload(payloadOptions),
                );
                scheduleRefineMessageButtonRemoval(reply, payloadOptions);
                return reply;
        } catch (error) {
                logger.error(
                        'RefineMessage',
                        `OpenRouter request failed: ${error.message}`,
                        error,
                );
                return interaction.editReply(
                        refineMessageGeneratedPayload({
                                answer: refineMessageErrorMessage(),
                        }),
                );
        }
};

const handleRefineMessageToneSelect = async (interaction) => {
        const parts = parseRefineMessageParts(interaction.customId);
        if (!parts || parts.action !== 'tone') return;

        const { sourceId, userId } = parts;
        if (interaction.user.id !== userId) {
                return interaction.reply({
                        content: 'This refine menu belongs to someone else.',
                        flags: MessageFlags.Ephemeral,
                });
        }

        const source = await getRefineMessageSource(
                interaction,
                sourceId,
                userId,
        );
        if (!source) {
                return interaction.reply({
                        content: 'This refine request has expired.',
                        flags: MessageFlags.Ephemeral,
                });
        }

        const tone = interaction.values?.[0];
        if (tone === 'custom') {
                return interaction.showModal(
                        refineMessageCustomToneModal(sourceId, userId),
                );
        }

        return runRefineMessageGeneration({
                interaction,
                sourceId,
                userId,
                source,
                tone: tone || 'normal',
                updateOriginal: true,
        });
};

const showRefineMessageRetryModal = async (interaction) => {
        const parts = parseRefineMessageParts(interaction.customId);
        if (!parts || parts.action !== 'retry') return;

        const { sourceId, userId } = parts;
        if (interaction.user.id !== userId) {
                return interaction.reply({
                        content: 'This retry button belongs to someone else.',
                        flags: MessageFlags.Ephemeral,
                });
        }

        const source = await getRefineMessageSource(
                interaction,
                sourceId,
                userId,
        );
        if (!source) {
                return interaction.reply({
                        content: 'This refine request has expired.',
                        flags: MessageFlags.Ephemeral,
                });
        }

        return interaction.showModal(refineMessageRetryModal(sourceId, userId));
};

const handleRefineMessageCustomToneModal = async (interaction) => {
        const parts = parseRefineMessageParts(interaction.customId);
        if (!parts || parts.action !== 'custommodal') return;

        const { sourceId, userId } = parts;
        if (interaction.user.id !== userId) {
                return interaction.reply({
                        content: 'This custom tone form belongs to someone else.',
                        flags: MessageFlags.Ephemeral,
                });
        }

        const source = await getRefineMessageSource(
                interaction,
                sourceId,
                userId,
        );
        if (!source) {
                return interaction.reply({
                        content: 'This refine request has expired.',
                        flags: MessageFlags.Ephemeral,
                });
        }

        const customTone = interaction.fields
                .getTextInputValue(REFINE_MESSAGE_CUSTOM_TONE_INPUT_ID)
                ?.trim();
        if (!customTone) {
                return interaction.reply({
                        content: 'Please enter a tone.',
                        flags: MessageFlags.Ephemeral,
                });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        return runRefineMessageGeneration({
                interaction,
                sourceId,
                userId,
                source,
                tone: 'custom',
                customTone,
        });
};

const handleRefineMessageRetryModal = async (interaction) => {
        const parts = parseRefineMessageParts(interaction.customId);
        if (!parts || parts.action !== 'retrymodal') return;

        const { sourceId, userId } = parts;
        if (interaction.user.id !== userId) {
                return interaction.reply({
                        content: 'This retry form belongs to someone else.',
                        flags: MessageFlags.Ephemeral,
                });
        }

        const source = await getRefineMessageSource(
                interaction,
                sourceId,
                userId,
        );
        if (!source) {
                return interaction.reply({
                        content: 'This refine request has expired.',
                        flags: MessageFlags.Ephemeral,
                });
        }

        const changeRequest = interaction.fields
                .getTextInputValue(REFINE_MESSAGE_CHANGES_INPUT_ID)
                ?.trim();
        if (!changeRequest) {
                return interaction.reply({
                        content: 'Please describe what to change.',
                        flags: MessageFlags.Ephemeral,
                });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        return runRefineMessageGeneration({
                interaction,
                sourceId,
                userId,
                source,
                tone: source.tone || 'normal',
                customTone: source.customTone || '',
                changeRequest,
                previousRefinement: source.previousRefinement || '',
        });
};

const parseExplainMessageParts = (customId) => {
        const [, action, sourceId, userId] = customId.split(':');
        if (!['retry', 'retrymodal'].includes(action)) return null;
        return { action, sourceId, userId };
};

const getExplainMessageSource = async (interaction, sourceId, userId) => {
        const source = parseStoredExplainMessageSource(
                await interaction.client.c.get(
                        explainMessageSourceKey(sourceId),
                ),
        );

        if (!source || source.userId !== userId) return null;
        return source;
};

const explainMessageErrorMessage = () =>
        'I could not explain that right now. Try again in a bit.';

const runExplainMessageGeneration = async ({
        interaction,
        sourceId,
        userId,
        source,
        changeRequest = '',
        previousExplanation = '',
}) => {
        const startedAt = Date.now();

        if (interaction.deferred) {
                await interaction.editReply(
                        explainMessagePayload({
                                status: 'Explaining the message...',
                        }),
                );
        }

        try {
                const result = await explainMessageOpenRouter({
                        sourceMessage: source,
                        changeRequest,
                        previousExplanation,
                });
                const duration = formatAskDuration(Date.now() - startedAt);

                await storeExplainMessageSource(interaction.client, sourceId, {
                        ...source,
                        previousExplanation: result.answer,
                });

                const payloadOptions = {
                        body: result.answer,
                        footer: `generated in ${duration}`,
                        sourceId,
                        userId,
                        includeRetryButton: true,
                };
                const reply = await interaction.editReply(
                        explainMessagePayload(payloadOptions),
                );
                scheduleExplainMessageButtonRemoval(reply, payloadOptions);
                return reply;
        } catch (error) {
                logger.error(
                        'ExplainMessage',
                        `OpenRouter request failed: ${error.message}`,
                        error,
                );
                return interaction.editReply(
                        explainMessagePayload({
                                body: explainMessageErrorMessage(),
                        }),
                );
        }
};

const showExplainMessageRetryModal = async (interaction) => {
        const parts = parseExplainMessageParts(interaction.customId);
        if (!parts || parts.action !== 'retry') return;

        const { sourceId, userId } = parts;
        if (interaction.user.id !== userId) {
                return interaction.reply({
                        content: 'This retry button belongs to someone else.',
                        flags: MessageFlags.Ephemeral,
                });
        }

        const source = await getExplainMessageSource(
                interaction,
                sourceId,
                userId,
        );
        if (!source) {
                return interaction.reply({
                        content: 'This explanation has expired.',
                        flags: MessageFlags.Ephemeral,
                });
        }

        return interaction.showModal(
                explainMessageRetryModal(sourceId, userId),
        );
};

const handleExplainMessageRetryModal = async (interaction) => {
        const parts = parseExplainMessageParts(interaction.customId);
        if (!parts || parts.action !== 'retrymodal') return;

        const { sourceId, userId } = parts;
        if (interaction.user.id !== userId) {
                return interaction.reply({
                        content: 'This retry form belongs to someone else.',
                        flags: MessageFlags.Ephemeral,
                });
        }

        const source = await getExplainMessageSource(
                interaction,
                sourceId,
                userId,
        );
        if (!source) {
                return interaction.reply({
                        content: 'This explanation has expired.',
                        flags: MessageFlags.Ephemeral,
                });
        }

        const changeRequest = interaction.fields
                .getTextInputValue(EXPLAIN_MESSAGE_CHANGES_INPUT_ID)
                ?.trim();
        if (!changeRequest) {
                return interaction.reply({
                        content: 'Please describe what to change.',
                        flags: MessageFlags.Ephemeral,
                });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        return runExplainMessageGeneration({
                interaction,
                sourceId,
                userId,
                source,
                changeRequest,
                previousExplanation: source.previousExplanation || '',
        });
};

const parseTranslateMessageParts = (customId) => {
        const [, action, sourceId, userId] = customId.split(':');
        if (
                !['language', 'retry', 'languagemodal', 'retrymodal'].includes(
                        action,
                )
        ) {
                return null;
        }
        return { action, sourceId, userId };
};

const getTranslateMessageSource = async (interaction, sourceId, userId) => {
        const source = parseStoredTranslateMessageSource(
                await interaction.client.c.get(
                        translateMessageSourceKey(sourceId),
                ),
        );

        if (!source || source.userId !== userId) return null;
        return source;
};

const translateMessageErrorMessage = () =>
        'I could not translate that right now. Try again in a bit.';

const runTranslateMessageGeneration = async ({
        interaction,
        sourceId,
        userId,
        source,
        targetLanguage = 'English',
        changeRequest = '',
        previousTranslation = '',
}) => {
        const startedAt = Date.now();

        if (interaction.deferred) {
                await interaction.editReply(
                        translateMessagePayload({
                                status: `Translating to ${targetLanguage}...`,
                        }),
                );
        }

        try {
                const result = await translateMessageOpenRouter({
                        sourceMessage: source,
                        targetLanguage,
                        changeRequest,
                        previousTranslation,
                });
                const duration = formatAskDuration(Date.now() - startedAt);

                await storeTranslateMessageSource(
                        interaction.client,
                        sourceId,
                        {
                                ...source,
                                targetLanguage,
                                previousTranslation: result.answer,
                        },
                );

                const payloadOptions = {
                        translation: result.answer,
                        targetLanguage,
                        footer: `generated in ${duration}`,
                        sourceId,
                        userId,
                        includeButtons: true,
                };
                const reply = await interaction.editReply(
                        translateMessagePayload(payloadOptions),
                );
                scheduleTranslateMessageButtonRemoval(reply, payloadOptions);
                return reply;
        } catch (error) {
                logger.error(
                        'TranslateMessage',
                        `OpenRouter request failed: ${error.message}`,
                        error,
                );
                return interaction.editReply(
                        translateMessagePayload({
                                translation: translateMessageErrorMessage(),
                        }),
                );
        }
};

const showTranslateMessageLanguageModal = async (interaction) => {
        const parts = parseTranslateMessageParts(interaction.customId);
        if (!parts || parts.action !== 'language') return;

        const { sourceId, userId } = parts;
        if (interaction.user.id !== userId) {
                return interaction.reply({
                        content: 'This translate button belongs to someone else.',
                        flags: MessageFlags.Ephemeral,
                });
        }

        const source = await getTranslateMessageSource(
                interaction,
                sourceId,
                userId,
        );
        if (!source) {
                return interaction.reply({
                        content: 'This translation has expired.',
                        flags: MessageFlags.Ephemeral,
                });
        }

        return interaction.showModal(
                translateMessageLanguageModal(sourceId, userId),
        );
};

const showTranslateMessageRetryModal = async (interaction) => {
        const parts = parseTranslateMessageParts(interaction.customId);
        if (!parts || parts.action !== 'retry') return;

        const { sourceId, userId } = parts;
        if (interaction.user.id !== userId) {
                return interaction.reply({
                        content: 'This retry button belongs to someone else.',
                        flags: MessageFlags.Ephemeral,
                });
        }

        const source = await getTranslateMessageSource(
                interaction,
                sourceId,
                userId,
        );
        if (!source) {
                return interaction.reply({
                        content: 'This translation has expired.',
                        flags: MessageFlags.Ephemeral,
                });
        }

        return interaction.showModal(
                translateMessageRetryModal(sourceId, userId),
        );
};

const handleTranslateMessageLanguageModal = async (interaction) => {
        const parts = parseTranslateMessageParts(interaction.customId);
        if (!parts || parts.action !== 'languagemodal') return;

        const { sourceId, userId } = parts;
        if (interaction.user.id !== userId) {
                return interaction.reply({
                        content: 'This language form belongs to someone else.',
                        flags: MessageFlags.Ephemeral,
                });
        }

        const source = await getTranslateMessageSource(
                interaction,
                sourceId,
                userId,
        );
        if (!source) {
                return interaction.reply({
                        content: 'This translation has expired.',
                        flags: MessageFlags.Ephemeral,
                });
        }

        const targetLanguage = interaction.fields
                .getTextInputValue(TRANSLATE_MESSAGE_LANGUAGE_INPUT_ID)
                ?.trim();
        if (!targetLanguage) {
                return interaction.reply({
                        content: 'Please enter a language.',
                        flags: MessageFlags.Ephemeral,
                });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        return runTranslateMessageGeneration({
                interaction,
                sourceId,
                userId,
                source,
                targetLanguage,
        });
};

const handleTranslateMessageRetryModal = async (interaction) => {
        const parts = parseTranslateMessageParts(interaction.customId);
        if (!parts || parts.action !== 'retrymodal') return;

        const { sourceId, userId } = parts;
        if (interaction.user.id !== userId) {
                return interaction.reply({
                        content: 'This retry form belongs to someone else.',
                        flags: MessageFlags.Ephemeral,
                });
        }

        const source = await getTranslateMessageSource(
                interaction,
                sourceId,
                userId,
        );
        if (!source) {
                return interaction.reply({
                        content: 'This translation has expired.',
                        flags: MessageFlags.Ephemeral,
                });
        }

        const changeRequest = interaction.fields
                .getTextInputValue(TRANSLATE_MESSAGE_CHANGES_INPUT_ID)
                ?.trim();
        if (!changeRequest) {
                return interaction.reply({
                        content: 'Please describe what to change.',
                        flags: MessageFlags.Ephemeral,
                });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        return runTranslateMessageGeneration({
                interaction,
                sourceId,
                userId,
                source,
                targetLanguage: source.targetLanguage || 'English',
                changeRequest,
                previousTranslation: source.previousTranslation || '',
        });
};

const followUpButton = (route, userId, plan, method) =>
        new ButtonBuilder()
                .setCustomId(
                        premiumCustomId(
                                'followopen',
                                route,
                                userId,
                                plan,
                                method,
                        ),
                )
                .setLabel('Reply')
                .setStyle(ButtonStyle.Secondary);

const premiumSentPayload = (plan, method, userId, sent) => {
        const container = new ContainerBuilder()
                .setAccentColor(0xffffff)
                .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                                sent > 0
                                        ? '<a:am_white_heart:1538556413121405048> **Sent.**\nThanks for willing to buy Saanvi premium. The owner has received your request.'
                                        : '<a:am_white_heart:1538556413121405048> **Request saved.**\nI could not DM the owner right now. Please contact support manually.',
                        ),
                )
                .addSeparatorComponents(
                        new SeparatorBuilder()
                                .setSpacing(SeparatorSpacingSize.Small)
                                .setDivider(true),
                )
                .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                                premiumPlanPaymentText(plan, method),
                        ),
                );

        return {
                components: [container],
                flags: MessageFlags.IsComponentsV2,
        };
};

const premiumUserFollowUpPayload = (message, plan, method, userId) => {
        const container = new ContainerBuilder()
                .setAccentColor(0xffffff)
                .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                                '**Premium Reply**\n' + `**Owner:** ${message}`,
                        ),
                )
                .addSeparatorComponents(
                        new SeparatorBuilder()
                                .setSpacing(SeparatorSpacingSize.Small)
                                .setDivider(true),
                )
                .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                                premiumPlanPaymentText(plan, method),
                        ),
                )
                .addActionRowComponents(
                        new ActionRowBuilder().addComponents(
                                followUpButton('owners', userId, plan, method),
                        ),
                );

        return {
                components: [container],
                flags: MessageFlags.IsComponentsV2,
        };
};

const enforcePremiumRequestLimit = async (client, userId) => {
        if (canBypassPremiumRequestLimit(userId)) return null;

        const cooldownKey = `premium:req:cooldown:${userId}`;
        const dayKey = `premium:req:day:${userId}`;
        const weekKey = `premium:req:week:${userId}`;

        const cooldownSet = await client.c.setnxex(cooldownKey, true, 600);
        if (!cooldownSet)
                return 'Please wait 10 minutes before sending another premium request.';

        const dayCount = await client.c.incr(dayKey);
        if (dayCount === 1) await client.c.expire(dayKey, 86400);
        if (dayCount > 2)
                return 'Daily limit reached. You can request premium access 2 times per day.';

        const weekCount = await client.c.incr(weekKey);
        if (weekCount === 1) await client.c.expire(weekKey, 604800);
        if (weekCount > 5)
                return 'Weekly limit reached. You can request premium access 5 times per week.';

        return null;
};

const notifyOwnersOfPremiumRequest = async (interaction, plan, method) => {
        const serverValue = interaction.guild
                ? `${interaction.guild.name} (\`${interaction.guild.id}\`)`
                : 'User app / DM context';
        const container = new ContainerBuilder()
                .setAccentColor(0xffffff)
                .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                                '**Premium Access Request**\n' +
                                        '<:premium:1538553546352361572> A user requested premium access.',
                        ),
                )
                .addSeparatorComponents(
                        new SeparatorBuilder()
                                .setSpacing(SeparatorSpacingSize.Small)
                                .setDivider(true),
                )
                .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                                `**User:** ${interaction.user.tag} (\`${interaction.user.id}\`)\n` +
                                        `**Server:** ${serverValue}\n\n` +
                                        premiumPlanPaymentText(plan, method),
                        ),
                )
                .addActionRowComponents(
                        new ActionRowBuilder().addComponents(
                                followUpButton(
                                        'user',
                                        interaction.user.id,
                                        plan,
                                        method,
                                ),
                        ),
                );
        const payload = {
                components: [container],
                flags: MessageFlags.IsComponentsV2,
        };

        let sent = 0;
        for (const ownerId of config.ownerIds || []) {
                try {
                        const owner =
                                await interaction.client.users.fetch(ownerId);
                        await owner.send(payload);
                        sent++;
                } catch (error) {
                        logger.warn(
                                'Premium',
                                `Failed to DM owner ${ownerId}: ${error.message}`,
                        );
                }
        }

        return sent;
};

const showPremiumFollowUpModal = async (
        interaction,
        route,
        userId,
        plan,
        method,
) => {
        if (route === 'user' && !isOwner(interaction.user.id)) {
                return interaction.deferUpdate().catch(() => {});
        }

        if (route === 'owners' && interaction.user.id !== userId) {
                return interaction.reply({
                        content: 'This reply belongs to someone else.',
                        flags: MessageFlags.Ephemeral,
                });
        }

        const modal = new ModalBuilder()
                .setCustomId(
                        premiumCustomId(
                                'followmodal',
                                route,
                                userId,
                                plan,
                                method,
                        ),
                )
                .setTitle('Premium Reply')
                .addComponents(
                        new ActionRowBuilder().addComponents(
                                new TextInputBuilder()
                                        .setCustomId(FOLLOW_UP_MESSAGE_INPUT_ID)
                                        .setLabel('Message')
                                        .setStyle(TextInputStyle.Paragraph)
                                        .setMinLength(1)
                                        .setMaxLength(1000)
                                        .setRequired(true),
                        ),
                );

        return interaction.showModal(modal);
};

const showPremiumSupportModal = async (interaction, plan) => {
        const modal = new ModalBuilder()
                .setCustomId(
                        premiumCustomId(
                                'supportmodal',
                                plan,
                                interaction.user.id,
                        ),
                )
                .setTitle('Premium Support')
                .addComponents(
                        new ActionRowBuilder().addComponents(
                                new TextInputBuilder()
                                        .setCustomId(
                                                PREMIUM_SUPPORT_MESSAGE_INPUT_ID,
                                        )
                                        .setLabel('Premium access question')
                                        .setPlaceholder(
                                                'Ask only about premium access, pricing, payment, or activation.',
                                        )
                                        .setStyle(TextInputStyle.Paragraph)
                                        .setMinLength(5)
                                        .setMaxLength(1000)
                                        .setRequired(true),
                        ),
                );

        return interaction.showModal(modal);
};

const premiumSupportWarningPayload = (plan, userId) => {
        const container = new ContainerBuilder()
                .setAccentColor(0xffffff)
                .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                                '**Premium Support**\n' +
                                        'Please use this form only for premium-access related questions, including pricing, payment, activation, or eligibility.\n\n' +
                                        '**Warning:** Repeated spam, unrelated messages, or misuse of this feature may result in a blacklist.',
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
                                                premiumCustomId(
                                                        'supportopen',
                                                        plan,
                                                        userId,
                                                ),
                                        )
                                        .setLabel('Continue')
                                        .setStyle(ButtonStyle.Secondary),
                        ),
                );

        return {
                components: [container],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        };
};

const sendPremiumSupportQuestionToOwners = async (
        interaction,
        plan,
        message,
) => {
        const serverValue = interaction.guild
                ? `${interaction.guild.name}. (${interaction.guild.id})`
                : 'User app / DM context';
        const container = new ContainerBuilder()
                .setAccentColor(0xffffff)
                .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                                `${DOTS_EMOJI} User: ${interaction.user.tag} (${interaction.user.id})\n` +
                                        `${DOTS_EMOJI} Server: ${serverValue}\n` +
                                        `${DOTS_EMOJI} Plan: ${planLabels[plan] || plan}\n\n` +
                                        `${CHAT_EMOJI} | Message:\n${quoteBlock(message)}`,
                        ),
                )
                .addActionRowComponents(
                        new ActionRowBuilder().addComponents(
                                followUpButton(
                                        'user',
                                        interaction.user.id,
                                        plan,
                                        'support',
                                ),
                        ),
                );
        const payload = {
                components: [container],
                flags: MessageFlags.IsComponentsV2,
        };

        let sent = 0;
        for (const ownerId of config.ownerIds || []) {
                try {
                        const owner =
                                await interaction.client.users.fetch(ownerId);
                        await owner.send(payload);
                        sent++;
                } catch (error) {
                        logger.warn(
                                'Premium',
                                `Failed to DM premium support question to owner ${ownerId}: ${error.message}`,
                        );
                }
        }

        return sent;
};

const sendPremiumFollowUpToUser = async (
        interaction,
        userId,
        plan,
        method,
        message,
) => {
        if (!isOwner(interaction.user.id)) {
                return interaction.deferUpdate().catch(() => {});
        }

        const target = await interaction.client.users
                .fetch(userId)
                .catch(() => null);
        if (!target) {
                return interaction.reply({
                        content: 'Could not find that user.',
                        flags: MessageFlags.Ephemeral,
                });
        }

        try {
                await target.send(
                        premiumUserFollowUpPayload(
                                message,
                                plan,
                                method,
                                userId,
                        ),
                );
        } catch (error) {
                logger.warn(
                        'Premium',
                        `Failed to DM premium reply to ${userId}: ${error.message}`,
                );
                return interaction.reply({
                        content: 'Could not DM that user. They may have DMs closed.',
                        flags: MessageFlags.Ephemeral,
                });
        }

        return interaction.reply({
                content: `Reply sent to ${target.tag}.`,
                flags: MessageFlags.Ephemeral,
        });
};

const sendPremiumFollowUpToOwners = async (
        interaction,
        userId,
        plan,
        method,
        message,
) => {
        if (interaction.user.id !== userId) {
                return interaction.reply({
                        content: 'This reply belongs to someone else.',
                        flags: MessageFlags.Ephemeral,
                });
        }

        const container = new ContainerBuilder()
                .setAccentColor(0xffffff)
                .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                                '**Premium Reply**\n' +
                                        'A user replied to a premium-access conversation.',
                        ),
                )
                .addSeparatorComponents(
                        new SeparatorBuilder()
                                .setSpacing(SeparatorSpacingSize.Small)
                                .setDivider(true),
                )
                .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                                `**User:** ${interaction.user.tag} (\`${interaction.user.id}\`)\n\n` +
                                        premiumPlanPaymentText(plan, method) +
                                        `\n\n**Message:** ${message}`,
                        ),
                )
                .addActionRowComponents(
                        new ActionRowBuilder().addComponents(
                                followUpButton('user', userId, plan, method),
                        ),
                );
        const payload = {
                components: [container],
                flags: MessageFlags.IsComponentsV2,
        };

        let sent = 0;
        for (const ownerId of config.ownerIds || []) {
                try {
                        const owner =
                                await interaction.client.users.fetch(ownerId);
                        await owner.send(payload);
                        sent++;
                } catch (error) {
                        logger.warn(
                                'Premium',
                                `Failed to DM owner ${ownerId}: ${error.message}`,
                        );
                }
        }

        return interaction.reply({
                content:
                        sent > 0
                                ? 'Reply sent to the owner.'
                                : 'Could not DM the owner. Please contact support manually.',
                flags: MessageFlags.Ephemeral,
        });
};

const handlePremiumFollowUpModal = async (interaction) => {
        const [, action, route, userId, plan, method] =
                interaction.customId.split(':');
        if (action !== 'followmodal') return;

        const message = interaction.fields
                .getTextInputValue(FOLLOW_UP_MESSAGE_INPUT_ID)
                ?.trim();
        if (!message) {
                return interaction.reply({
                        content: 'Please enter a message.',
                        flags: MessageFlags.Ephemeral,
                });
        }

        if (route === 'user') {
                return sendPremiumFollowUpToUser(
                        interaction,
                        userId,
                        plan,
                        method,
                        message,
                );
        }

        if (route === 'owners') {
                return sendPremiumFollowUpToOwners(
                        interaction,
                        userId,
                        plan,
                        method,
                        message,
                );
        }
};

const handlePremiumSupportModal = async (interaction) => {
        const [, action, plan, userId] = interaction.customId.split(':');
        if (action !== 'supportmodal') return;

        if (interaction.user.id !== userId) {
                return interaction.reply({
                        content: 'This premium support form belongs to someone else.',
                        flags: MessageFlags.Ephemeral,
                });
        }

        const message = interaction.fields
                .getTextInputValue(PREMIUM_SUPPORT_MESSAGE_INPUT_ID)
                ?.trim();
        if (!message) {
                return interaction.reply({
                        content: 'Please enter your premium-access question.',
                        flags: MessageFlags.Ephemeral,
                });
        }

        const limitMessage = await enforcePremiumRequestLimit(
                interaction.client,
                interaction.user.id,
        );
        if (limitMessage) {
                return interaction.reply({
                        content: limitMessage,
                        flags: MessageFlags.Ephemeral,
                });
        }

        const sent = await sendPremiumSupportQuestionToOwners(
                interaction,
                plan,
                message,
        );
        const container = new ContainerBuilder()
                .setAccentColor(0xffffff)
                .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                                sent > 0
                                        ? '**Premium Support Submitted**\nYour premium-access question has been sent to the owner. Please wait for a reply.'
                                        : '**Premium Support Saved**\nI could not DM the owner right now. Please contact support manually.',
                        ),
                );

        return interaction.reply({
                components: [container],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
};

const parseStoredTicket = (raw) => {
        if (!raw) return null;
        if (typeof raw === 'object') return raw;

        try {
                return JSON.parse(raw);
        } catch {
                return null;
        }
};

const handleSupportCategorySelect = async (interaction) => {
        const [, action, userId] = interaction.customId.split(':');
        if (action !== 'category') return;

        if (interaction.user.id !== userId) {
                return interaction.reply({
                        content: 'This support menu belongs to someone else.',
                        flags: MessageFlags.Ephemeral,
                });
        }

        const activeTicketId = await interaction.client.c.get(
                supportActiveKey(userId),
        );
        if (activeTicketId) {
                return interaction.reply(
                        supportAlreadyOpenPayload(activeTicketId),
                );
        }

        const category = interaction.values?.[0];
        if (!category) {
                return interaction.reply({
                        content: 'Please select a support category.',
                        flags: MessageFlags.Ephemeral,
                });
        }

        return interaction.showModal(supportModal(userId, category));
};

const notifyOwnersOfSupportTicket = async (interaction, ticket) => {
        const payload = supportOwnerTicketPayload(ticket);
        let sent = 0;

        for (const ownerId of config.ownerIds || []) {
                try {
                        const owner =
                                await interaction.client.users.fetch(ownerId);
                        await owner.send(payload);
                        sent++;
                } catch (error) {
                        logger.warn(
                                'Support',
                                `Failed to DM owner ${ownerId}: ${error.message}`,
                        );
                }
        }

        return sent;
};

const handleSupportTicketModal = async (interaction) => {
        const [, action, userId, category] = interaction.customId.split(':');
        if (action !== 'modal') return;

        if (interaction.user.id !== userId) {
                return interaction.reply({
                        content: 'This support modal belongs to someone else.',
                        flags: MessageFlags.Ephemeral,
                });
        }

        const message = interaction.fields
                .getTextInputValue(SUPPORT_MESSAGE_INPUT_ID)
                ?.trim();
        if (!message) {
                return interaction.reply({
                        content: 'Please describe your issue.',
                        flags: MessageFlags.Ephemeral,
                });
        }

        const ticketId = createSupportTicketId(userId);
        const reserved = await interaction.client.c.setnxex(
                supportActiveKey(userId),
                ticketId,
                SUPPORT_TICKET_TTL_SECONDS,
        );

        if (!reserved) {
                const activeTicketId = await interaction.client.c.get(
                        supportActiveKey(userId),
                );
                return interaction.reply(
                        supportAlreadyOpenPayload(activeTicketId),
                );
        }

        const ticket = {
                id: ticketId,
                userId,
                userTag: interaction.user.tag,
                category,
                message,
                createdAt: Date.now(),
        };

        await interaction.client.c.set(
                supportTicketKey(ticketId),
                JSON.stringify(ticket),
                SUPPORT_TICKET_TTL_SECONDS,
        );

        const sent = await notifyOwnersOfSupportTicket(interaction, ticket);
        return interaction.reply(
                supportSubmittedPayload(ticketId, category, userId, sent),
        );
};

const buildFallbackTicket = (ticketId, userId) => ({
        id: ticketId,
        userId,
        userTag: userId ? `<@${userId}>` : 'Unknown User',
        category: 'unknown',
        message: 'Ticket data is no longer cached, but this button still has the user id.',
});

const parseSupportReplyParts = (customId) => {
        const [, action, maybeRoute, maybeTicketId, maybeUserId] =
                customId.split(':');
        if (action !== 'reply' && action !== 'replymodal') return null;

        if (['owner', 'user'].includes(maybeRoute)) {
                return {
                        action,
                        route: maybeRoute,
                        ticketId: maybeTicketId,
                        userId: maybeUserId,
                };
        }

        return {
                action,
                route: 'owner',
                ticketId: maybeRoute,
                userId: maybeTicketId,
        };
};

const showSupportReplyModal = async (interaction) => {
        const parts = parseSupportReplyParts(interaction.customId);
        if (!parts || parts.action !== 'reply') return;

        const { route, ticketId, userId } = parts;

        if (route === 'owner' && !isOwner(interaction.user.id)) {
                return interaction.reply({
                        content: 'Only the owner can reply to support tickets.',
                        flags: MessageFlags.Ephemeral,
                });
        }

        if (route === 'user' && interaction.user.id !== userId) {
                return interaction.reply({
                        content: 'This support ticket reply belongs to someone else.',
                        flags: MessageFlags.Ephemeral,
                });
        }

        if (!ticketId || !userId) {
                return interaction.reply({
                        content: 'This ticket reply button is missing ticket data.',
                        flags: MessageFlags.Ephemeral,
                });
        }

        return interaction.showModal(
                supportReplyModal(route, ticketId, userId),
        );
};

const handleSupportReplyModal = async (interaction) => {
        const parts = parseSupportReplyParts(interaction.customId);
        if (!parts || parts.action !== 'replymodal') return;

        const { route, ticketId, userId } = parts;

        if (route === 'owner' && !isOwner(interaction.user.id)) {
                return interaction.reply({
                        content: 'Only the owner can reply to support tickets.',
                        flags: MessageFlags.Ephemeral,
                });
        }

        if (route === 'user' && interaction.user.id !== userId) {
                return interaction.reply({
                        content: 'This support ticket reply belongs to someone else.',
                        flags: MessageFlags.Ephemeral,
                });
        }

        const message = interaction.fields
                .getTextInputValue(SUPPORT_REPLY_MESSAGE_INPUT_ID)
                ?.trim();
        if (!message) {
                return interaction.reply({
                        content: 'Please enter a reply.',
                        flags: MessageFlags.Ephemeral,
                });
        }

        const ticket =
                parseStoredTicket(
                        await interaction.client.c.get(
                                supportTicketKey(ticketId),
                        ),
                ) || buildFallbackTicket(ticketId, userId);

        if (route === 'user') {
                let sent = 0;
                for (const ownerId of config.ownerIds || []) {
                        try {
                                const owner =
                                        await interaction.client.users.fetch(
                                                ownerId,
                                        );
                                await owner.send(
                                        supportUserReplyOwnerPayload(
                                                ticket,
                                                interaction.user.tag,
                                                message,
                                        ),
                                );
                                sent++;
                        } catch (error) {
                                logger.warn(
                                        'Support',
                                        `Failed to DM support user reply to owner ${ownerId}: ${error.message}`,
                                );
                        }
                }

                return interaction.reply({
                        content:
                                sent > 0
                                        ? 'Reply sent to the owner.'
                                        : 'Could not DM the owner. Please contact support manually.',
                        flags: MessageFlags.Ephemeral,
                });
        }

        const target = await interaction.client.users
                .fetch(userId)
                .catch(() => null);

        if (!target) {
                return interaction.reply({
                        content: 'Could not find that user.',
                        flags: MessageFlags.Ephemeral,
                });
        }

        try {
                await target.send(supportReplyUserPayload(ticket, message));
        } catch (error) {
                logger.warn(
                        'Support',
                        `Failed to DM support reply to ${userId}: ${error.message}`,
                );
                return interaction.reply({
                        content: 'Could not DM that user. They may have DMs closed.',
                        flags: MessageFlags.Ephemeral,
                });
        }

        return interaction.reply({
                content: `Reply sent to ${target.tag}.`,
                flags: MessageFlags.Ephemeral,
        });
};

const handleSupportCloseButton = async (interaction) => {
        const [, action, ticketId, encodedUserId] =
                interaction.customId.split(':');
        if (action !== 'close') return;

        if (!isOwner(interaction.user.id)) {
                return interaction.reply({
                        content: 'Only the owner can close support tickets.',
                        flags: MessageFlags.Ephemeral,
                });
        }

        const ticket =
                parseStoredTicket(
                        await interaction.client.c.get(
                                supportTicketKey(ticketId),
                        ),
                ) ||
                (encodedUserId
                        ? buildFallbackTicket(ticketId, encodedUserId)
                        : null);
        if (!ticket) {
                return interaction.reply({
                        content: 'This ticket is already closed or expired.',
                        flags: MessageFlags.Ephemeral,
                });
        }

        await interaction.client.c.del(supportActiveKey(ticket.userId));
        await interaction.client.c.del(supportTicketKey(ticketId));

        await interaction.update(supportOwnerTicketPayload(ticket, true));

        const target = await interaction.client.users
                .fetch(ticket.userId)
                .catch(() => null);
        if (target) {
                await target
                        .send(supportClosedUserPayload(ticket))
                        .catch((error) => {
                                logger.warn(
                                        'Support',
                                        `Failed to notify user ${ticket.userId}: ${error.message}`,
                                );
                        });
        }
};

const handlePremiumComponent = async (interaction) => {
        const parts = interaction.customId.split(':');
        const action = parts[1];
        const plan = parts[2];
        const ownerId = parts.at(-1);

        if (action === 'followopen') {
                const [, , route, userId, followPlan, method] = parts;
                return showPremiumFollowUpModal(
                        interaction,
                        route,
                        userId,
                        followPlan,
                        method,
                );
        }

        if (action === 'supportopen') {
                const supportPlan = parts[2];
                const userId = parts[3];
                if (
                        userId &&
                        userId !== '0' &&
                        userId !== interaction.user.id
                ) {
                        return interaction.reply({
                                content: 'This premium support menu belongs to someone else.',
                                flags: MessageFlags.Ephemeral,
                        });
                }

                return showPremiumSupportModal(interaction, supportPlan);
        }

        if (ownerId && ownerId !== '0' && ownerId !== interaction.user.id) {
                return interaction.reply({
                        content: 'This premium menu belongs to someone else.',
                        flags: MessageFlags.Ephemeral,
                });
        }

        if (action === 'plan') {
                return interaction.update(
                        premiumPlanPayload(plan, interaction.user.id),
                );
        }

        if (action === 'back') {
                return interaction.update(
                        premiumPricingPayload(interaction.user.id),
                );
        }

        if (action === 'request') {
                return interaction.update(
                        premiumPaymentPayload(plan, interaction.user.id),
                );
        }

        if (action === 'payback') {
                return interaction.update(
                        premiumPlanPayload(plan, interaction.user.id),
                );
        }

        if (action === 'ask-support') {
                return interaction.reply(
                        premiumSupportWarningPayload(plan, interaction.user.id),
                );
        }

        if (action === 'contact-support') {
                return interaction.reply(
                        premiumSupportWarningPayload(plan, interaction.user.id),
                );
        }

        if (action === 'payselect') {
                const method = interaction.values?.[0];
                if (!method) {
                        return interaction.reply({
                                content: 'Please select a payment method.',
                                flags: MessageFlags.Ephemeral,
                        });
                }

                const limitMessage = await enforcePremiumRequestLimit(
                        interaction.client,
                        interaction.user.id,
                );
                if (limitMessage) {
                        return interaction.reply({
                                content: limitMessage,
                                flags: MessageFlags.Ephemeral,
                        });
                }

                const sent = await notifyOwnersOfPremiumRequest(
                        interaction,
                        plan,
                        method,
                );
                return interaction.update(
                        premiumSentPayload(
                                plan,
                                method,
                                interaction.user.id,
                                sent > 0,
                        ),
                );
        }
};

const ensureBookmarkOwner = (interaction, userId) => {
        if (interaction.user.id === userId) return true;

        interaction
                .reply({
                        content: 'This bookmark menu belongs to someone else.',
                        flags: MessageFlags.Ephemeral,
                })
                .catch(() => {});
        return false;
};

const getBookmarkSource = async (interaction, sourceId) =>
        parseStoredBookmarkSource(
                await interaction.client.c.get(bookmarkSourceKey(sourceId)),
        );

const handleBookmarkSaveSelect = async (interaction) => {
        const [, action, sourceId, userId] = interaction.customId.split(':');
        if (action !== 'save') return;
        if (!ensureBookmarkOwner(interaction, userId)) return;

        const source = await getBookmarkSource(interaction, sourceId);
        if (!source) return interaction.update(bookmarkExpiredPayload());

        const collectionId = interaction.values?.[0];
        if (!collectionId) {
                return interaction.reply({
                        content: 'Please select a collection.',
                        flags: MessageFlags.Ephemeral,
                });
        }

        const result = await db.user.addBookmarkToCollection(
                userId,
                collectionId,
                source,
        );
        await interaction.client.c.del(bookmarkSourceKey(sourceId));

        return interaction.update(bookmarkSavedPayload(result));
};

const showBookmarkCreateModal = async (interaction) => {
        const [, action, sourceId, userId] = interaction.customId.split(':');
        if (action !== 'create') return;
        if (!ensureBookmarkOwner(interaction, userId)) return;

        const bookmarks = await db.user.getBookmarks(userId);
        if ((bookmarks.collections?.length || 0) >= 4) {
                return interaction.reply(bookmarkLimitPayload());
        }

        return interaction.showModal(
                bookmarkCreateCollectionModal(sourceId, userId),
        );
};

const handleBookmarkCreateModal = async (interaction) => {
        const [, action, sourceId, userId] = interaction.customId.split(':');
        if (action !== 'createmodal') return;
        if (!ensureBookmarkOwner(interaction, userId)) return;

        const source = await getBookmarkSource(interaction, sourceId);
        if (!source) return interaction.reply(bookmarkExpiredPayload());

        const name = interaction.fields
                .getTextInputValue(BOOKMARK_NAME_INPUT_ID)
                ?.trim();
        if (!name) {
                return interaction.reply({
                        content: 'Please enter a collection name.',
                        flags: MessageFlags.Ephemeral,
                });
        }

        try {
                const collection = await db.user.createBookmarkCollection(
                        userId,
                        name,
                );
                const result = await db.user.addBookmarkToCollection(
                        userId,
                        collection.id,
                        source,
                );
                await interaction.client.c.del(bookmarkSourceKey(sourceId));

                return interaction.reply(bookmarkSavedPayload(result));
        } catch (error) {
                if (error.code === 'BOOKMARK_COLLECTION_LIMIT') {
                        return interaction.reply(bookmarkLimitPayload());
                }
                throw error;
        }
};

const handleBookmarksListSelect = async (interaction) => {
        const [, action, userId] = interaction.customId.split(':');
        if (action !== 'list') return;
        if (!ensureBookmarkOwner(interaction, userId)) return;

        const collectionId = interaction.values?.[0];
        const bookmarks = await db.user.getBookmarks(userId);
        const collection = bookmarks.collections.find(
                (entry) => entry.id === collectionId,
        );

        if (!collection) {
                return interaction.update(
                        bookmarksCollectionMenuPayload(
                                bookmarks.collections,
                                userId,
                        ),
                );
        }

        return interaction.update(
                bookmarksCollectionPagePayload({
                        collection,
                        page: 1,
                        userId,
                }),
        );
};

const handleBookmarksPageButton = async (interaction) => {
        const [, action, collectionId, page, userId] =
                interaction.customId.split(':');
        if (action !== 'page' || collectionId === 'label') return;
        if (!ensureBookmarkOwner(interaction, userId)) return;

        const bookmarks = await db.user.getBookmarks(userId);
        const collection = bookmarks.collections.find(
                (entry) => entry.id === collectionId,
        );

        if (!collection) {
                return interaction.update(
                        bookmarksCollectionMenuPayload(
                                bookmarks.collections,
                                userId,
                        ),
                );
        }

        return interaction.update(
                bookmarksCollectionPagePayload({
                        collection,
                        page,
                        userId,
                }),
        );
};

const showBookmarkDeleteConfirm = async (interaction) => {
        const [, action, collectionId, page, userId] =
                interaction.customId.split(':');
        if (action !== 'delete') return;
        if (!ensureBookmarkOwner(interaction, userId)) return;

        const bookmarks = await db.user.getBookmarks(userId);
        const collection = bookmarks.collections.find(
                (entry) => entry.id === collectionId,
        );

        if (!collection) {
                return interaction.update(
                        bookmarksCollectionMenuPayload(
                                bookmarks.collections,
                                userId,
                        ),
                );
        }

        return interaction.update(
                bookmarkDeleteConfirmPayload({
                        collection,
                        page,
                        userId,
                }),
        );
};

const handleBookmarkDeleteConfirm = async (interaction) => {
        const [, action, collectionId, userId] =
                interaction.customId.split(':');
        if (action !== 'deleteconfirm') return;
        if (!ensureBookmarkOwner(interaction, userId)) return;

        try {
                const collection = await db.user.deleteBookmarkCollection(
                        userId,
                        collectionId,
                );
                return interaction.update(
                        bookmarkDeletedPayload(collection.name),
                );
        } catch (error) {
                if (error.code === 'BOOKMARK_COLLECTION_NOT_FOUND') {
                        const bookmarks = await db.user.getBookmarks(userId);
                        return interaction.update(
                                bookmarksCollectionMenuPayload(
                                        bookmarks.collections,
                                        userId,
                                ),
                        );
                }
                throw error;
        }
};

const handleBookmarkDeleteCancel = async (interaction) => {
        const [, action, collectionId, page, userId] =
                interaction.customId.split(':');
        if (action !== 'deletecancel') return;
        if (!ensureBookmarkOwner(interaction, userId)) return;

        const bookmarks = await db.user.getBookmarks(userId);
        const collection = bookmarks.collections.find(
                (entry) => entry.id === collectionId,
        );

        if (!collection) {
                return interaction.update(
                        bookmarksCollectionMenuPayload(
                                bookmarks.collections,
                                userId,
                        ),
                );
        }

        return interaction.update(
                bookmarksCollectionPagePayload({
                        collection,
                        page,
                        userId,
                }),
        );
};

const handleMessageComponent = async (interaction) => {
        if (
                ![ComponentType.Button, ComponentType.StringSelect].includes(
                        interaction.componentType,
                )
        )
                return;

        if (
                interaction.customId === PREMIUM_PRICING_BUTTON_ID ||
                interaction.customId.startsWith(`${PREMIUM_PRICING_BUTTON_ID}:`)
        ) {
                await handlePremiumPricingButton(interaction);
        } else if (interaction.customId.startsWith(PREMIUM_COMPONENT_PREFIX)) {
                await handlePremiumComponent(interaction);
        } else if (
                interaction.customId.startsWith(SUPPORT_CATEGORY_SELECT_PREFIX)
        ) {
                await handleSupportCategorySelect(interaction);
        } else if (interaction.customId.startsWith(SUPPORT_REPLY_PREFIX)) {
                await showSupportReplyModal(interaction);
        } else if (interaction.customId.startsWith(ASK_REPLY_PREFIX)) {
                await showAskReplyModal(interaction);
        } else if (interaction.customId.startsWith(SUGGEST_REPLY_TONE_PREFIX)) {
                await handleSuggestReplyToneSelect(interaction);
        } else if (
                interaction.customId.startsWith(SUGGEST_REPLY_RETRY_PREFIX)
        ) {
                await showSuggestReplyRetryModal(interaction);
        } else if (
                interaction.customId.startsWith(REFINE_MESSAGE_TONE_PREFIX)
        ) {
                await handleRefineMessageToneSelect(interaction);
        } else if (
                interaction.customId.startsWith(REFINE_MESSAGE_RETRY_PREFIX)
        ) {
                await showRefineMessageRetryModal(interaction);
        } else if (
                interaction.customId.startsWith(EXPLAIN_MESSAGE_RETRY_PREFIX)
        ) {
                await showExplainMessageRetryModal(interaction);
        } else if (
                interaction.customId.startsWith(
                        TRANSLATE_MESSAGE_LANGUAGE_PREFIX,
                )
        ) {
                await showTranslateMessageLanguageModal(interaction);
        } else if (
                interaction.customId.startsWith(TRANSLATE_MESSAGE_RETRY_PREFIX)
        ) {
                await showTranslateMessageRetryModal(interaction);
        } else if (
                interaction.customId.startsWith(BOOKMARK_SAVE_SELECT_PREFIX)
        ) {
                await handleBookmarkSaveSelect(interaction);
        } else if (interaction.customId.startsWith(BOOKMARK_CREATE_PREFIX)) {
                await showBookmarkCreateModal(interaction);
        } else if (
                interaction.customId.startsWith(BOOKMARK_LIST_SELECT_PREFIX)
        ) {
                await handleBookmarksListSelect(interaction);
        } else if (interaction.customId.startsWith(BOOKMARK_PAGE_PREFIX)) {
                await handleBookmarksPageButton(interaction);
        } else if (
                interaction.customId.startsWith(BOOKMARK_DELETE_CONFIRM_PREFIX)
        ) {
                await handleBookmarkDeleteConfirm(interaction);
        } else if (
                interaction.customId.startsWith(BOOKMARK_DELETE_CANCEL_PREFIX)
        ) {
                await handleBookmarkDeleteCancel(interaction);
        } else if (interaction.customId.startsWith(BOOKMARK_DELETE_PREFIX)) {
                await showBookmarkDeleteConfirm(interaction);
        } else if (interaction.customId.startsWith(SUPPORT_CLOSE_PREFIX)) {
                await handleSupportCloseButton(interaction);
        } else if (interaction.customId.startsWith('addy_qr:')) {
                await handleQrButton(interaction);
        } else if (interaction.customId.startsWith('upi_qr:')) {
                await handleUpiQrButton(interaction);
        } else if (interaction.customId.startsWith('paypal_qr:')) {
                await handlePaypalQrButton(interaction);
        }
};

export default {
        name: 'interactionCreate',
        async execute({ eventArgs, client }) {
                if (!eventArgs || !eventArgs[0] || !client) return;

                const [interaction] = eventArgs;

                try {
                        if (
                                interaction.type ===
                                InteractionType.ApplicationCommand
                        ) {
                                await handleChatInputCommand(
                                        interaction,
                                        client,
                                );
                        } else if (
                                interaction.type ===
                                InteractionType.ApplicationCommandAutocomplete
                        ) {
                                await handleAutocomplete(interaction, client);
                        } else if (
                                interaction.type ===
                                InteractionType.MessageComponent
                        ) {
                                await handleMessageComponent(interaction);
                        } else if (
                                interaction.type === InteractionType.ModalSubmit
                        ) {
                                if (
                                        interaction.customId.startsWith(
                                                `${PREMIUM_COMPONENT_PREFIX}followmodal:`,
                                        )
                                ) {
                                        await handlePremiumFollowUpModal(
                                                interaction,
                                        );
                                } else if (
                                        interaction.customId.startsWith(
                                                `${PREMIUM_COMPONENT_PREFIX}supportmodal:`,
                                        )
                                ) {
                                        await handlePremiumSupportModal(
                                                interaction,
                                        );
                                } else if (
                                        interaction.customId.startsWith(
                                                SUPPORT_REPLY_MODAL_PREFIX,
                                        )
                                ) {
                                        await handleSupportReplyModal(
                                                interaction,
                                        );
                                } else if (
                                        interaction.customId.startsWith(
                                                ASK_REPLY_MODAL_PREFIX,
                                        )
                                ) {
                                        await handleAskReplyModal(interaction);
                                } else if (
                                        interaction.customId.startsWith(
                                                SUGGEST_REPLY_CUSTOM_MODAL_PREFIX,
                                        )
                                ) {
                                        await handleSuggestReplyCustomToneModal(
                                                interaction,
                                        );
                                } else if (
                                        interaction.customId.startsWith(
                                                SUGGEST_REPLY_RETRY_MODAL_PREFIX,
                                        )
                                ) {
                                        await handleSuggestReplyRetryModal(
                                                interaction,
                                        );
                                } else if (
                                        interaction.customId.startsWith(
                                                REFINE_MESSAGE_CUSTOM_MODAL_PREFIX,
                                        )
                                ) {
                                        await handleRefineMessageCustomToneModal(
                                                interaction,
                                        );
                                } else if (
                                        interaction.customId.startsWith(
                                                REFINE_MESSAGE_RETRY_MODAL_PREFIX,
                                        )
                                ) {
                                        await handleRefineMessageRetryModal(
                                                interaction,
                                        );
                                } else if (
                                        interaction.customId.startsWith(
                                                EXPLAIN_MESSAGE_RETRY_MODAL_PREFIX,
                                        )
                                ) {
                                        await handleExplainMessageRetryModal(
                                                interaction,
                                        );
                                } else if (
                                        interaction.customId.startsWith(
                                                TRANSLATE_MESSAGE_LANGUAGE_MODAL_PREFIX,
                                        )
                                ) {
                                        await handleTranslateMessageLanguageModal(
                                                interaction,
                                        );
                                } else if (
                                        interaction.customId.startsWith(
                                                TRANSLATE_MESSAGE_RETRY_MODAL_PREFIX,
                                        )
                                ) {
                                        await handleTranslateMessageRetryModal(
                                                interaction,
                                        );
                                } else if (
                                        interaction.customId.startsWith(
                                                BOOKMARK_CREATE_MODAL_PREFIX,
                                        )
                                ) {
                                        await handleBookmarkCreateModal(
                                                interaction,
                                        );
                                } else if (
                                        interaction.customId.startsWith(
                                                SUPPORT_MODAL_PREFIX,
                                        )
                                ) {
                                        await handleSupportTicketModal(
                                                interaction,
                                        );
                                }
                        }
                } catch (error) {
                        if (isUnknownInteraction(error)) {
                                logger.warn(
                                        'InteractionCreate',
                                        'Expired interaction ignored.',
                                );
                                return;
                        }
                        logger.error(
                                'InteractionCreate',
                                `Fatal error: ${error.message}`,
                                error,
                        );
                }
        },
};
