const { SlashCommandBuilder } = require('discord.js');
const { withLogoPayload } = require('../utils/brand');
const { LEVELS } = require('../utils/permissions');
const { virelloEmbed } = require('../utils/ticketUi');
const { fetchChangelog } = require('../services/dashboardSync');
const { SITE_URL } = require('../constants/plans');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('changelog')
    .setDescription('Latest Virello product updates from the website'),
  permissionLevel: LEVELS.everyone,
  permissionLabel: 'everyone',
  async execute(interaction) {
    const entries = await fetchChangelog();
    if (!entries.length) {
      const embed = virelloEmbed(interaction.guild.id, {
        title: '◆ VIRELLO — Changelog',
        description: 'No published updates yet. See the website for the latest news.',
        url: `${SITE_URL.replace(/\/$/, '')}/changelog`,
      });
      return interaction.reply(withLogoPayload([embed]));
    }

    const latest = entries.slice(0, 5);
    const embed = virelloEmbed(interaction.guild.id, {
      title: '◆ VIRELLO — Changelog',
      description: `Recent releases. Full history: ${SITE_URL.replace(/\/$/, '')}/changelog`,
      fields: latest.map((entry) => ({
        name: `v${entry.version} — ${entry.title}`,
        value: String(entry.body || '').slice(0, 900) || '—',
        inline: false,
      })),
    });
    return interaction.reply(withLogoPayload([embed]));
  },
};
