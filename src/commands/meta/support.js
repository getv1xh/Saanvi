import { Command } from '#command';
import {
	ContainerBuilder,
	TextDisplayBuilder,
	SeparatorBuilder,
	SeparatorSpacingSize,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	MessageFlags,
} from 'discord.js';
import { config } from '#config';

class SupportCommand extends Command {
	constructor() {
		super({
			name: 'support',
			description: 'Get a link to the support server',
			cooldown: 5,
			enabledSlash: true,
			shouldNotDefer: true,
			slashData: {
				name: 'support',
				description: 'Get a link to the support server',
			},
		});
	}

	async execute({ ctx }) {
		const container = new ContainerBuilder()
			.setAccentColor(0xffffff)
			.addTextDisplayComponents(
				new TextDisplayBuilder().setContent(
					'## Support\n-# Join our support server for help, updates and more',
				),
			)
			.addSeparatorComponents(
				new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true),
			)
			.addActionRowComponents(
				new ActionRowBuilder().addComponents(
					new ButtonBuilder()
						.setLabel('Support Server')
						.setStyle(ButtonStyle.Link)
						.setURL(config.links.supportServer),
				),
			);

		await ctx.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
	}
}

export default new SupportCommand();
