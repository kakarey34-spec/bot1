const { ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } = require('discord.js');
const licenseService = require('../services/licenseService');
const { SITE_URL } = require('../constants/plans');
const { hasPurchaserRole, denyPurchaserInteraction } = require('../utils/permissions');
const { withLogoPayload } = require('../utils/brand');
const { virelloEmbed } = require('../utils/ticketUi');
const store = require('../config/store');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mylicense')
    .setDescription('View your VIRELLO license status (buyers only)'),
  async execute(interaction) {
    if (!hasPurchaserRole(interaction.member)) {
      return denyPurchaserInteraction(interaction);
    }

    const license = licenseService.getLicense(interaction.guild.id, interaction.user.id);
    const status = licenseService.licenseStatus(license);
    const siteUrl = store.getGuild(interaction.guild.id).license?.siteUrl || SITE_URL;

    if (!license) {
      return interaction.reply({
        content:
          'You have the buyer role but no license record yet. Contact staff if you recently purchased.',
        ephemeral: true,
      });
    }

    const expiresUnix = Math.floor(status.expiresAt / 1000);
    const embed = virelloEmbed(interaction.guild.id, {
      title: '◆ Your VIRELLO license',
      description: status.active
        ? 'Your access is **active**.'
        : 'Your license has **expired**. Renew to restore access.',
      fields: [
        { name: 'Plan', value: status.planLabel, inline: true },
        {
          name: 'Months since purchase',
          value: String(status.monthsSincePurchase),
          inline: true,
        },
        {
          name: 'Term length',
          value: `${status.monthsTotal} month(s)`,
          inline: true,
        },
        {
          name: 'Expires',
          value: `<t:${expiresUnix}:F> (<t:${expiresUnix}:R>)`,
          inline: false,
        },
        {
          name: 'Days remaining',
          value: status.active ? String(status.daysLeft) : '0 (expired)',
          inline: true,
        },
        { name: 'Website', value: `[VIRELLO Secure](${siteUrl})`, inline: true },
      ],
    });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('Open website')
        .setStyle(ButtonStyle.Link)
        .setURL(siteUrl)
    );

    return interaction.reply({
      ...withLogoPayload([embed]),
      components: [row],
      ephemeral: true,
    });
  },
};
