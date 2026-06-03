const {
  ActionRowBuilder,
  ModalBuilder,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');

const REP_CHANNEL_ID = '1511488413327691816';
const REP_ROLE_ID = '1510614274299531334';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rep')
    .setDescription('Leave a service rating'),
  async execute(interaction) {
    if (interaction.channelId !== REP_CHANNEL_ID) {
      return interaction.reply({
        content: `You can only use /rep in <#${REP_CHANNEL_ID}>.`,
        ephemeral: true,
      });
    }

    if (!interaction.member.roles.cache.has(REP_ROLE_ID)) {
      return interaction.reply({
        content: 'You do not have permission to use /rep.',
        ephemeral: true,
      });
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

module.exports.REP_CHANNEL_ID = REP_CHANNEL_ID;
module.exports.REP_ROLE_ID = REP_ROLE_ID;
