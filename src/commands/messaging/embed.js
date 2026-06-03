const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js');
const store = require('../../config/store');
const { LEVELS } = require('../../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('embed')
    .setDescription('Send a custom rich embed through the bot')
    .addStringOption((opt) =>
      opt.setName('title').setDescription('Embed title').setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('description')
        .setDescription('Embed description (use \\n for line breaks)')
        .setRequired(true)
    )
    .addChannelOption((opt) =>
      opt
        .setName('channel')
        .setDescription('Channel to send in (defaults to this channel)')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    )
    .addStringOption((opt) =>
      opt.setName('color').setDescription('Hex color, e.g. #57f287 or 57f287')
    )
    .addStringOption((opt) => opt.setName('footer').setDescription('Embed footer text')),
  permissionLevel: LEVELS.admin,
  permissionLabel: 'admin',
  async execute(interaction) {
    const channel = interaction.options.getChannel('channel') || interaction.channel;
    const title = interaction.options.getString('title');
    const description = interaction.options.getString('description');
    const colorHex = interaction.options.getString('color');
    const footer = interaction.options.getString('footer');
    const config = store.getGuild(interaction.guild.id);

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(description.replace(/\\n/g, '\n'))
      .setTimestamp();

    if (colorHex && /^#?[0-9a-f]{6}$/i.test(colorHex)) {
      embed.setColor(parseInt(colorHex.replace('#', ''), 16));
    } else {
      embed.setColor(config.embeds.color ?? 0x5865f2);
    }

    if (footer) embed.setFooter({ text: footer });
    else if (config.embeds.footer) embed.setFooter({ text: config.embeds.footer });

    await channel.send({ embeds: [embed] });
    return interaction.reply({ content: `Embed sent to ${channel}.`, ephemeral: true });
  },
};
