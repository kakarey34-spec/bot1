const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const store = require('../config/store');
const { BRAND, brandFooter } = require('../utils/brand');
const { SITE_URL } = require('../constants/plans');

function scannerDownloadUrl(guildId) {
  const config = store.getGuild(guildId);
  return (
    process.env.SCANNER_DOWNLOAD_URL ||
    config.scanner?.downloadUrl ||
    'https://github.com/popesmoke/test/releases/latest'
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('scanner')
    .setDescription('Download and run the Virello scanner')
    .setDMPermission(true)
    .addSubcommand((sub) => sub.setName('guide').setDescription('How PIN scans work and where to download')),
  async execute(interaction) {
    const siteUrl = store.getGuild(interaction.guildId || process.env.GUILD_ID).license?.siteUrl || SITE_URL;
    const downloadUrl = scannerDownloadUrl(interaction.guildId || process.env.GUILD_ID);

    const embed = new EmbedBuilder()
      .setColor(BRAND.red)
      .setTitle('Virello Scanner — quick guide')
      .setDescription(
        [
          '**1.** Open the dashboard and sign in with Discord (buyers need the **Access** role).',
          '**2.** Click **Generate New PIN** and copy the 6-digit code.',
          '**3.** Download the scanner, enter the PIN, accept consent, and wait for the scan to finish.',
          '**4.** Your reviewer refreshes the dashboard to read the completed report.',
        ].join('\n')
      )
      .addFields(
        { name: 'Dashboard', value: `[Open dashboard](${siteUrl})`, inline: true },
        { name: 'Download', value: `[Get scanner](${downloadUrl})`, inline: true }
      )
      .setFooter(brandFooter(interaction.guildId))
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setLabel('Dashboard').setStyle(ButtonStyle.Link).setURL(siteUrl),
      new ButtonBuilder().setLabel('Download scanner').setStyle(ButtonStyle.Link).setURL(downloadUrl)
    );

    return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
  },
};
