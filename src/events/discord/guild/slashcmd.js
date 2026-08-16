import {
        InteractionType,
        ComponentType,
        ContainerBuilder,
        TextDisplayBuilder,
        SeparatorBuilder,
        SeparatorSpacingSize,
        MessageFlags,
        AttachmentBuilder,
        EmbedBuilder,
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
                box:    { left: 135, top: 183, right: 602, bottom: 593 },
                pad:    18,
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
        flags: options.flags ? options.flags & ~MessageFlags.Ephemeral : options.flags,
});

const sendError = async (interaction, title, description, forceEphemeral = false) => {
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
                const canSend = interaction.channel && interaction.inGuild()
                        ? canBotSendMessages(interaction.channel)
                        : true;
                const flags =
                        !canSend || forceEphemeral
                                ? MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                                : MessageFlags.IsComponentsV2;

                const reply = { components: [errorContainer], flags };

                if (interaction.deferred) {
                        await interaction.editReply(publicEditOptions(reply)).catch(() => {});
                } else if (interaction.replied) {
                        await interaction.followUp(reply).catch(() => {});
                } else {
                        await interaction.reply(reply).catch(() => {});
                }
        } catch (error) {
                logger.error('InteractionCreate', `Failed to send error: ${error.message}`);
        }
};

const sendCooldown = async (interaction, cooldown) => {
        if (!interaction || !cooldown) return;

        try {
                const timestamp = Math.floor((Date.now() + cooldown) / 1000);

                let content = `**Cooldown** - Ends <t:${timestamp}:R>`;

                const cooldownContainer = new ContainerBuilder();
                cooldownContainer.setAccentColor(config.colors?.warn || 0xfee75c);
                cooldownContainer.addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(content),
                );
                const reply = {
                        components: [cooldownContainer],
                        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
                };

                if (interaction.deferred) {
                        await interaction.editReply(publicEditOptions(reply)).catch(() => {});
                } else if (interaction.replied) {
                        await interaction.followUp(reply).catch(() => {});
                } else {
                        await interaction.reply(reply).catch(() => {});
                }
        } catch (error) {
                logger.error('InteractionCreate', `Failed to send cooldown: ${error.message}`);
        }
};

const respond = async (interaction, options) => {
        if (interaction.deferred) return interaction.editReply(publicEditOptions(options));
        if (interaction.replied) return interaction.followUp(options);
        return interaction.reply(options);
};

const isUnknownInteraction = (error) =>
        error?.code === 10062 || error?.rawError?.code === 10062;

const deferInteraction = async (interaction) => {
        if (!interaction || interaction.deferred || interaction.replied) return true;

        try {
                await interaction.deferReply();
                return true;
        } catch (error) {
                if (isUnknownInteraction(error)) {
                        logger.warn('InteractionCreate', `Interaction expired before defer: /${interaction.commandName}`);
                        return false;
                }
                throw error;
        }
};

const getCommandFile = (interaction, client) => {
        if (!interaction || !client || !client.commandHandler) return null;

        try {
                const { commandName } = interaction;
                const subCommandGroup = interaction.options?.getSubcommandGroup(false);
                const subCommandName = interaction.options?.getSubcommand(false);

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
                logger.error('InteractionCreate', `Error getting command file: ${error.message}`);
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

                const deferred = await deferInteraction(interaction);
                if (!deferred) return;

                const inGuild   = interaction.inGuild();
                const userId    = interaction.user.id;
                const guildId   = interaction.guild?.id ?? null;
                const channelId = interaction.channel?.id ?? null;

                if (inGuild && interaction.channel && !canBotSendMessages(interaction.channel)) {
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

                const shouldCheckPremium =
                        config.premium.enabled &&
                        !canBypassPremium(commandToExecute) &&
                        !isOwner(userId);

                let isUserBlacklisted  = false;
                let isGuildBlacklisted = false;
                let isChannelIgnored   = false;

                try {
                        [isUserBlacklisted, isGuildBlacklisted, isChannelIgnored] = await Promise.all([
                                db.blacklist?.checkBlacklist(userId).catch(() => false) ?? false,
                                inGuild && guildId ? db.blacklist?.checkBlacklist(guildId).catch(() => false) ?? false : false,
                                inGuild && guildId && channelId ? db.guild?.isChannelIgnored(guildId, channelId).catch(() => false) ?? false : false,
                        ]);
                } catch (error) {
                        logger.error('InteractionCreate', `Database check failed: ${error.message}`);
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
                        return respond(interaction, premiumPromptOptions(userId)).catch(() => {});
                }

                const cooldownScope = guildId ?? userId;
                if (commandToExecute.cooldown && client.commandHandler) {
                        try {
                                const cooldown = await client.commandHandler.isOnCooldown(
                                        commandToExecute,
                                        userId,
                                        cooldownScope,
                                );
                                if (cooldown) {
                                        return await sendCooldown(interaction, cooldown);
                                }
                                await client.commandHandler.setCooldown(commandToExecute, userId, cooldownScope);
                        } catch (error) {
                                logger.error('InteractionCreate', `Cooldown check failed: ${error.message}`);
                        }
                }

                try {
                        const ctx = new CommandContext({ client, interaction });
                        const permissionValidation = await validateCommand(ctx, commandToExecute);
                        if (!permissionValidation.valid) {
                                return sendError(
                                        interaction,
                                        permissionValidation.error?.title || 'Permission Error',
                                        permissionValidation.error?.description || 'You cannot use this command.',
                                        true,
                                );
                        }
                        await commandToExecute.execute({ ctx });
                } catch (error) {
                        if (isUnknownInteraction(error)) {
                                logger.warn('InteractionCreate', `Interaction expired while executing: ${commandToExecute.slashData?.name || 'unknown'}`);
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
                        logger.warn('InteractionCreate', `Expired interaction ignored: /${interaction?.commandName || 'unknown'}`);
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

                const frame = QR_FRAMES[Math.floor(Math.random() * QR_FRAMES.length)];

                const boxW = frame.box.right - frame.box.left;
                const boxH = frame.box.bottom - frame.box.top;
                const qrSize = Math.min(boxW, boxH) - frame.pad * 2;

                const qrBuf = await QRCode.toBuffer(address, {
                        type: 'png',
                        width: qrSize,
                        margin: 1,
                        color: { dark: '#000000', light: '#00000000' },
                });

                const offsetX = frame.box.left + Math.floor((boxW - qrSize) / 2);
                const offsetY = frame.box.top  + Math.floor((boxH - qrSize) / 2);

                const compositeBuf = await sharp(frame.buffer)
                        .composite([{ input: qrBuf, top: offsetY, left: offsetX }])
                        .png()
                        .toBuffer();

                const attachment = new AttachmentBuilder(compositeBuf, { name: 'qr.png' });

                await interaction.editReply({ components: [] });
                await interaction.followUp({ files: [attachment] });
        } catch (error) {
                logger.error('InteractionCreate', `QR generation error: ${error.message}`);
                await interaction.followUp({ content: 'Failed to generate QR code.' }).catch(() => {});
        }
};

const handleUpiQrButton = async (interaction) => {
        try {
                await interaction.deferUpdate();

                const upiId = interaction.customId.slice('upi_qr:'.length);
                const upiUrl = `upi://pay?pa=${encodeURIComponent(upiId)}`;

                const frame = QR_FRAMES[Math.floor(Math.random() * QR_FRAMES.length)];

                const boxW = frame.box.right - frame.box.left;
                const boxH = frame.box.bottom - frame.box.top;
                const qrSize = Math.min(boxW, boxH) - frame.pad * 2;

                const qrBuf = await QRCode.toBuffer(upiUrl, {
                        type: 'png',
                        width: qrSize,
                        margin: 1,
                        color: { dark: '#000000', light: '#00000000' },
                });

                const offsetX = frame.box.left + Math.floor((boxW - qrSize) / 2);
                const offsetY = frame.box.top  + Math.floor((boxH - qrSize) / 2);

                const compositeBuf = await sharp(frame.buffer)
                        .composite([{ input: qrBuf, top: offsetY, left: offsetX }])
                        .png()
                        .toBuffer();

                const attachment = new AttachmentBuilder(compositeBuf, { name: 'qr.png' });

                await interaction.editReply({ components: [] });
                await interaction.followUp({ files: [attachment] });
        } catch (error) {
                logger.error('InteractionCreate', `UPI QR generation error: ${error.message}`);
                await interaction.followUp({ content: 'Failed to generate QR code.' }).catch(() => {});
        }
};

const handlePaypalQrButton = async (interaction) => {
        try {
                await interaction.deferUpdate();

                const username  = interaction.customId.slice('paypal_qr:'.length);
                const paypalUrl = `https://paypal.me/${username.replace(/^@/, '')}`;

                const frame = QR_FRAMES[Math.floor(Math.random() * QR_FRAMES.length)];

                const boxW  = frame.box.right - frame.box.left;
                const boxH  = frame.box.bottom - frame.box.top;
                const qrSize = Math.min(boxW, boxH) - frame.pad * 2;

                const qrBuf = await QRCode.toBuffer(paypalUrl, {
                        type: 'png',
                        width: qrSize,
                        margin: 1,
                        color: { dark: '#000000', light: '#00000000' },
                });

                const offsetX = frame.box.left + Math.floor((boxW - qrSize) / 2);
                const offsetY = frame.box.top  + Math.floor((boxH - qrSize) / 2);

                const compositeBuf = await sharp(frame.buffer)
                        .composite([{ input: qrBuf, top: offsetY, left: offsetX }])
                        .png()
                        .toBuffer();

                const attachment = new AttachmentBuilder(compositeBuf, { name: 'qr.png' });

                await interaction.editReply({ components: [] });
                await interaction.followUp({ files: [attachment] });
        } catch (error) {
                logger.error('InteractionCreate', `PayPal QR generation error: ${error.message}`);
                await interaction.followUp({ content: 'Failed to generate QR code.' }).catch(() => {});
        }
};

const handlePremiumPricingButton = async (interaction) => {
        try {
                const [, , ownerId] = interaction.customId.split(':');
                if (ownerId && ownerId !== '0' && ownerId !== interaction.user.id) {
                        return interaction.reply({
                                content: 'This premium menu belongs to someone else.',
                                flags: MessageFlags.Ephemeral,
                        });
                }

                await interaction.update(premiumPricingPayload(interaction.user.id));
        } catch (error) {
                logger.error('InteractionCreate', `Premium pricing button failed: ${error.message}`, error);
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

const premiumCustomId = (...parts) =>
        ['premium', ...parts].filter(Boolean).join(':');

const followUpButton = (route, userId, plan, method) =>
        new ButtonBuilder()
                .setCustomId(premiumCustomId('followopen', route, userId, plan, method))
                .setLabel('Follow Up')
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
                        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true),
                )
                .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                                `**Plan:** ${planLabels[plan] || plan}\n` +
                                `**Payment:** ${paymentLabels[method] || method}`,
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

const premiumUserFollowUpPayload = (message, plan, method, userId) => {
        const container = new ContainerBuilder()
                .setAccentColor(0xffffff)
                .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                                '**Premium Follow Up**\n' +
                                message,
                        ),
                )
                .addSeparatorComponents(
                        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true),
                )
                .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                                `**Plan:** ${planLabels[plan] || plan}\n` +
                                `**Payment:** ${paymentLabels[method] || method}`,
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
        if (!cooldownSet) return 'Please wait 10 minutes before sending another premium request.';

        const dayCount = await client.c.incr(dayKey);
        if (dayCount === 1) await client.c.expire(dayKey, 86400);
        if (dayCount > 2) return 'Daily limit reached. You can request premium access 2 times per day.';

        const weekCount = await client.c.incr(weekKey);
        if (weekCount === 1) await client.c.expire(weekKey, 604800);
        if (weekCount > 5) return 'Weekly limit reached. You can request premium access 5 times per week.';

        return null;
};

const notifyOwnersOfPremiumRequest = async (interaction, plan, method) => {
        const serverValue = interaction.guild
                ? `${interaction.guild.name} (\`${interaction.guild.id}\`)`
                : 'User app / DM context';
        const embed = new EmbedBuilder()
                .setColor(0xffffff)
                .setTitle('Premium Access Request')
                .setDescription('<:premium:1538553546352361572> A user requested premium access.')
                .addFields(
                        {
                                name: 'User',
                                value: `${interaction.user.tag} (\`${interaction.user.id}\`)`,
                                inline: false,
                        },
                        {
                                name: 'Server',
                                value: serverValue,
                                inline: false,
                        },
                        {
                                name: 'Plan',
                                value: planLabels[plan] || plan,
                                inline: true,
                        },
                        {
                                name: 'Payment',
                                value: paymentLabels[method] || method,
                                inline: true,
                        },
                )
                .setTimestamp();
        const row = new ActionRowBuilder().addComponents(
                followUpButton('user', interaction.user.id, plan, method),
        );

        let sent = 0;
        for (const ownerId of config.ownerIds || []) {
                try {
                        const owner = await interaction.client.users.fetch(ownerId);
                        await owner.send({ embeds: [embed], components: [row] });
                        sent++;
                } catch (error) {
                        logger.warn('Premium', `Failed to DM owner ${ownerId}: ${error.message}`);
                }
        }

        return sent;
};

const showPremiumFollowUpModal = async (interaction, route, userId, plan, method) => {
        if (route === 'user' && !isOwner(interaction.user.id)) {
                return interaction.deferUpdate().catch(() => {});
        }

        if (route === 'owners' && interaction.user.id !== userId) {
                return interaction.reply({
                        content: 'This follow up belongs to someone else.',
                        flags: MessageFlags.Ephemeral,
                });
        }

        const modal = new ModalBuilder()
                .setCustomId(premiumCustomId('followmodal', route, userId, plan, method))
                .setTitle('Premium Follow Up')
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

const sendPremiumFollowUpToUser = async (interaction, userId, plan, method, message) => {
        if (!isOwner(interaction.user.id)) {
                return interaction.deferUpdate().catch(() => {});
        }

        const target = await interaction.client.users.fetch(userId).catch(() => null);
        if (!target) {
                return interaction.reply({
                        content: 'Could not find that user.',
                        flags: MessageFlags.Ephemeral,
                });
        }

        try {
                await target.send(
                        premiumUserFollowUpPayload(
                                `**Owner:**\n${message}`,
                                plan,
                                method,
                                userId,
                        ),
                );
        } catch (error) {
                logger.warn('Premium', `Failed to DM premium follow up to ${userId}: ${error.message}`);
                return interaction.reply({
                        content: 'Could not DM that user. They may have DMs closed.',
                        flags: MessageFlags.Ephemeral,
                });
        }

        return interaction.reply({
                content: `Follow up sent to ${target.tag}.`,
                flags: MessageFlags.Ephemeral,
        });
};

const sendPremiumFollowUpToOwners = async (interaction, userId, plan, method, message) => {
        if (interaction.user.id !== userId) {
                return interaction.reply({
                        content: 'This follow up belongs to someone else.',
                        flags: MessageFlags.Ephemeral,
                });
        }

        const embed = new EmbedBuilder()
                .setColor(0xffffff)
                .setTitle('Premium Follow Up')
                .setDescription('The user sent a premium follow-up message.')
                .addFields(
                        {
                                name: 'User',
                                value: `${interaction.user.tag} (\`${interaction.user.id}\`)`,
                                inline: false,
                        },
                        {
                                name: 'Plan',
                                value: planLabels[plan] || plan,
                                inline: true,
                        },
                        {
                                name: 'Payment',
                                value: paymentLabels[method] || method,
                                inline: true,
                        },
                        {
                                name: 'Message',
                                value: message,
                                inline: false,
                        },
                )
                .setTimestamp();
        const row = new ActionRowBuilder().addComponents(
                followUpButton('user', userId, plan, method),
        );

        let sent = 0;
        for (const ownerId of config.ownerIds || []) {
                try {
                        const owner = await interaction.client.users.fetch(ownerId);
                        await owner.send({ embeds: [embed], components: [row] });
                        sent++;
                } catch (error) {
                        logger.warn('Premium', `Failed to DM owner ${ownerId}: ${error.message}`);
                }
        }

        return interaction.reply({
                content: sent > 0
                        ? 'Follow up sent to the owner.'
                        : 'Could not DM the owner. Please contact support manually.',
                flags: MessageFlags.Ephemeral,
        });
};

const handlePremiumFollowUpModal = async (interaction) => {
        const [, action, route, userId, plan, method] = interaction.customId.split(':');
        if (action !== 'followmodal') return;

        const message = interaction.fields.getTextInputValue(FOLLOW_UP_MESSAGE_INPUT_ID)?.trim();
        if (!message) {
                return interaction.reply({
                        content: 'Please enter a message.',
                        flags: MessageFlags.Ephemeral,
                });
        }

        if (route === 'user') {
                return sendPremiumFollowUpToUser(interaction, userId, plan, method, message);
        }

        if (route === 'owners') {
                return sendPremiumFollowUpToOwners(interaction, userId, plan, method, message);
        }
};

const handlePremiumComponent = async (interaction) => {
        const parts = interaction.customId.split(':');
        const action = parts[1];
        const plan = parts[2];
        const ownerId = parts.at(-1);

        if (action === 'followopen') {
                const [, , route, userId, followPlan, method] = parts;
                return showPremiumFollowUpModal(interaction, route, userId, followPlan, method);
        }

        if (ownerId && ownerId !== '0' && ownerId !== interaction.user.id) {
                return interaction.reply({
                        content: 'This premium menu belongs to someone else.',
                        flags: MessageFlags.Ephemeral,
                });
        }

        if (action === 'plan') {
                return interaction.update(premiumPlanPayload(plan, interaction.user.id));
        }

        if (action === 'back') {
                return interaction.update(premiumPricingPayload(interaction.user.id));
        }

        if (action === 'request') {
                return interaction.update(premiumPaymentPayload(plan, interaction.user.id));
        }

        if (action === 'payback') {
                return interaction.update(premiumPlanPayload(plan, interaction.user.id));
        }

        if (action === 'contact-support') {
                return interaction.reply({
                        content: 'Contact support will be available soon.',
                        flags: MessageFlags.Ephemeral,
                });
        }

        if (action === 'payselect') {
                const method = interaction.values?.[0];
                if (!method) {
                        return interaction.reply({
                                content: 'Please select a payment method.',
                                flags: MessageFlags.Ephemeral,
                        });
                }

                const limitMessage = await enforcePremiumRequestLimit(interaction.client, interaction.user.id);
                if (limitMessage) {
                        return interaction.reply({ content: limitMessage, flags: MessageFlags.Ephemeral });
                }

                const sent = await notifyOwnersOfPremiumRequest(interaction, plan, method);
                return interaction.update(premiumSentPayload(plan, method, interaction.user.id, sent > 0));
        }
};

const handleMessageComponent = async (interaction) => {
        if (![ComponentType.Button, ComponentType.StringSelect].includes(interaction.componentType)) return;

        if (interaction.customId === PREMIUM_PRICING_BUTTON_ID || interaction.customId.startsWith(`${PREMIUM_PRICING_BUTTON_ID}:`)) {
                await handlePremiumPricingButton(interaction);
        } else if (interaction.customId.startsWith(PREMIUM_COMPONENT_PREFIX)) {
                await handlePremiumComponent(interaction);
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
                        if (interaction.type === InteractionType.ApplicationCommand) {
                                await handleChatInputCommand(interaction, client);
                        } else if (interaction.type === InteractionType.ApplicationCommandAutocomplete) {
                                await handleAutocomplete(interaction, client);
                        } else if (interaction.type === InteractionType.MessageComponent) {
                                await handleMessageComponent(interaction);
                        } else if (interaction.type === InteractionType.ModalSubmit) {
                                if (interaction.customId.startsWith(`${PREMIUM_COMPONENT_PREFIX}followmodal:`)) {
                                        await handlePremiumFollowUpModal(interaction);
                                }
                        }
                } catch (error) {
                        if (isUnknownInteraction(error)) {
                                logger.warn('InteractionCreate', 'Expired interaction ignored.');
                                return;
                        }
                        logger.error('InteractionCreate', `Fatal error: ${error.message}`, error);
                }
        },
};
