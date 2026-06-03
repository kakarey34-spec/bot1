const { SlashCommandBuilder, ChannelType } = require('discord.js');
const { LEVELS } = require('../../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('say')
    .setDescription('Send a message through the bot')
    .addStringOption((opt) =>
      opt.setName('message').setDescription('Message text to send').setRequired(true)
    )
    .addChannelOption((opt) =>
      opt
        .setName('channel')
        .setDescription('Channel to send in (defaults to this channel)')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    ),
  permissionLevel: LEVELS.admin,
  permissionLabel: 'admin',
  async execute(interaction) {
    const channel = interaction.options.getChannel('channel') || interaction.channel;
    const text = interaction.options.getString('message');

    if (!channel.isTextBased()) {
      return interaction.reply({ content: 'That channel cannot receive messages.', ephemeral: true });
    }

    await channel.send({ content: text });
    return interaction.reply({ content: `Message sent to ${channel}.`, ephemeral: true });
  },
};
