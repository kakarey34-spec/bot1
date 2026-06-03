const {
  ActionRowBuilder,
  ModalBuilder,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const store = require('../config/store');
const { hasPurchaserRole, denyPurchaserInteraction } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rep')
    .setDescription('Leave a service rating (buyers only, in rep channel)'),
  async execute(interaction) {
    const config = store.getGuild(interaction.guild.id);
    const repChannelId = config.channels?.repChannelId;
    if (!repChannelId) {
      return interaction.reply({
        content: 'Rep channel is not configured. Ask staff to run `/config channel key:rep`.',
        ephemeral: true,
      });
    }

    if (interaction.channelId !== repChannelId) {
      return interaction.reply({
        content: `You can only use /rep in <#${repChannelId}>.`,
        ephemeral: true,
      });
    }

    if (!hasPurchaserRole(interaction.member)) {
      return denyPurchaserInteraction(interaction);
    }

    const modal = new ModalBuilder()
      .setCustomId(`rep:${interaction.channelId}:${interaction.user.id}`)
      .setTitle('Rate our service');

    const starsInput = new TextInputBuilder()
      .setCustomId('stars')
      .setLabel('How many stars?')
      .setPlaceholder('Type a number from 1 to 5')
      .setStyle(TextInputStyle.Short)
      .setMinLength(1)
      .setMaxLength(1)
      .setRequired(true);

    const ratingInput = new TextInputBuilder()
      .setCustomId('rating')
      .setLabel('Rate our service with words')
      .setPlaceholder('Tell us what you thought about the service')
      .setStyle(TextInputStyle.Paragraph)
      .setMinLength(3)
      .setMaxLength(1000)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(starsInput),
      new ActionRowBuilder().addComponents(ratingInput)
    );

    return interaction.showModal(modal);
  },
};
