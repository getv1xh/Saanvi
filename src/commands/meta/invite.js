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

class InviteCommand extends Command {
	constructor() {
		super({
			name: 'invite',
			description: 'Invite Saanvi to your server or install as an app',
			cooldown: 5,
			enabledSlash: true,
			shouldNotDefer: true,
			slashData: {
				name: 'invite',
				description: 'Invite Saanvi to your server or install as an app',
			},
		});
	}

	async execute({ ctx }) {
		const container = new ContainerBuilder()
			.setAccentColor(0xffffff)
			.addTextDisplayComponents(
				new TextDisplayBuilder().setContent(
					'## Invite Saanvi\n-# Use the buttons below to invite me to your server or install me as an application',
				),
			)
			.addSeparatorComponents(
				new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true),
			)
			.addActionRowComponents(
				new ActionRowBuilder().addComponents(
					new ButtonBuilder()
						.setLabel('Invite')
						.setStyle(ButtonStyle.Link)
						.setURL(config.links.invite),
					new ButtonBuilder()
						.setLabel('Install')
						.setStyle(ButtonStyle.Link)
						.setURL(config.links.install),
				),
			);

		await ctx.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
	}
}

export default new InviteCommand();
