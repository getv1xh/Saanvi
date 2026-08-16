import {
        InteractionType,
        ComponentType,
        ContainerBuilder,
        TextDisplayBuilder,
        SeparatorBuilder,
        SeparatorSpacingSize,
        MessageFlags,
        AttachmentBuilder,
} from 'discord.js';
import { config } from '#config';
import {
        validateCommand,
        canBotSendMessages,
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

const enforcePremiumRequestLimit = async (client, userId) => {
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
        const guildLine = interaction.guild
                ? `**Server:** ${interaction.guild.name} (\`${interaction.guild.id}\`)`
                : '**Server:** User app / DM context';
        const content =
                '<:premium:1538553546352361572> **Premium Access Request**\n' +
                `**User:** ${interaction.user.tag} (\`${interaction.user.id}\`)\n` +
                `${guildLine}\n` +
                `**Plan:** ${planLabels[plan] || plan}\n` +
                `**Payment:** ${paymentLabels[method] || method}`;

        let sent = 0;
        for (const ownerId of config.ownerIds || []) {
                try {
                        const owner = await interaction.client.users.fetch(ownerId);
                        await owner.send(content);
                        sent++;
                } catch (error) {
                        logger.warn('Premium', `Failed to DM owner ${ownerId}: ${error.message}`);
                }
        }

        return sent;
};

const handlePremiumComponent = async (interaction) => {
        const parts = interaction.customId.split(':');
        const action = parts[1];
        const plan = parts[2];
        const ownerId = parts.at(-1);

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

        if (action === 'pay') {
                const method = parts[3];
                const limitMessage = await enforcePremiumRequestLimit(interaction.client, interaction.user.id);
                if (limitMessage) {
                        return interaction.reply({ content: limitMessage, flags: MessageFlags.Ephemeral });
                }

                const sent = await notifyOwnersOfPremiumRequest(interaction, plan, method);
                return interaction.update({
                        components: [
                                premiumPlanPayload(plan, interaction.user.id).components[0]
                                        .addTextDisplayComponents(
                                                new TextDisplayBuilder().setContent(
                                                        sent > 0
                                                                ? `-# Request sent to owner. Payment: ${paymentLabels[method] || method}`
                                                                : '-# Could not DM the owner. Please contact support manually.',
                                                ),
                                        ),
                        ],
                        flags: MessageFlags.IsComponentsV2,
                });
        }
};

const handleMessageComponent = async (interaction) => {
        if (interaction.componentType !== ComponentType.Button) return;

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
