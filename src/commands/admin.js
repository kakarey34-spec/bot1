const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const store = require('../config/store');
const backup = require('../services/backupService');
const { adminPanelUrl } = require('../admin/auth');
const { BRAND, brandFooter } = require('../utils/brand');

const GUILD_ID = process.env.GUILD_ID || process.env.DISCORD_GUILD_ID || '';

function guildOverview(guildId) {
  if (!guildId) {
    return {
      ticketCount: 0,
      openTicketCount: 0,
      licenseCount: 0,
      activeLicenseCount: 0,
    };
  }
  const tickets = store.listTicketsForGuild(guildId);
  const licenses = store.listLicensesForGuild(guildId);
  const now = Date.now();
  return {
    ticketCount: tickets.length,
    openTicketCount: tickets.filter((t) => t.stage !== 'closed').length,
    licenseCount: licenses.length,
    activeLicenseCount: licenses.filter((l) => !l.expiresAt || l.expiresAt > now).length,
  };
}

function overviewEmbed(interaction, overview, health) {
  const panelUrl = adminPanelUrl();
  const embed = new EmbedBuilder()
    .setColor(BRAND.red)
    .setTitle('Virello Bot — Owner admin')
    .setDescription('Private operations summary for this server.')
    .addFields(
      { name: 'Open tickets', value: String(overview.openTicketCount), inline: true },
      { name: 'Total tickets', value: String(overview.ticketCount), inline: true },
      { name: 'Active licenses', value: String(overview.activeLicenseCount), inline: true },
      { name: 'All licenses', value: String(overview.licenseCount), inline: true },
      {
        name: 'Database',
        value: health?.database?.connected ? `Connected (${health.database.engine})` : 'Degraded',
        inline: true,
      },
      {
        name: 'Backup',
        value: health?.backup?.configured ? 'Configured' : 'Not configured',
        inline: true,
      }
    )
    .setFooter(brandFooter(interaction.guildId))
    .setTimestamp();

  if (panelUrl) {
    embed.addFields({
      name: 'Web panel',
      value: `[Open /admin](${panelUrl}) — tickets, licenses, manual backup`,
    });
  }

  return embed;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('admin')
    .setDescription('Bot owner tools — stats, health, and backups')
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub.setName('overview').setDescription('Ticket/license stats and web panel link')
    )
    .addSubcommand((sub) =>
      sub.setName('health').setDescription('Database and backup health check')
    )
    .addSubcommand((sub) =>
      sub.setName('backup').setDescription('Upload a database backup to Discord now')
    ),
  superAdminOnly: true,
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId || GUILD_ID;
    await interaction.deferReply({ ephemeral: true });

    if (sub === 'backup') {
      try {
        await backup.createAndUploadBackup();
        return interaction.editReply({
          content: 'Database backup uploaded to the configured Discord channel.',
        });
      } catch (error) {
        return interaction.editReply({
          content: `Backup failed: ${error.message}`,
        });
      }
    }

    const health = await backup.getHealthStatus();
    const overview = guildOverview(guildId);

    if (sub === 'health') {
      const embed = new EmbedBuilder()
        .setColor(health.status === 'ok' ? BRAND.success : BRAND.warning)
        .setTitle('Bot health')
        .addFields(
          { name: 'Status', value: health.status, inline: true },
          { name: 'Database', value: health.database?.engine || 'unknown', inline: true },
          {
            name: 'DB connected',
            value: health.database?.connected ? 'Yes' : 'No',
            inline: true,
          },
          {
            name: 'Backup enabled',
            value: health.backup?.enabled ? 'Yes' : 'No',
            inline: true,
          },
          {
            name: 'Last backup',
            value: health.backup?.last_backup_at || 'Never',
            inline: false,
          }
        )
        .setFooter(brandFooter(interaction.guildId))
        .setTimestamp();
      return interaction.editReply({ embeds: [embed] });
    }

    const embed = overviewEmbed(interaction, overview, health);
    const panelUrl = adminPanelUrl();
    const components = panelUrl
      ? [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setLabel('Open web admin').setStyle(ButtonStyle.Link).setURL(panelUrl)
          ),
        ]
      : [];

    return interaction.editReply({ embeds: [embed], components });
  },
};
