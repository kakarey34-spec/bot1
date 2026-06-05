const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandBuilder,
  InteractionContextType,
} = require('discord.js');
const licenseService = require('../services/licenseService');
const { SITE_URL } = require('../constants/plans');
const { hasPurchaserRole, denyPurchaserInteraction } = require('../utils/permissions');
const { withLogoPayload } = require('../utils/brand');
const { virelloEmbed } = require('../utils/ticketUi');
const store = require('../config/store');
const { fetchHomeGuildMember } = require('../utils/guildContext');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mylicense')
    .setDescription('View your VIRELLO license status (buyers only)')
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM),
  async execute(interaction, client) {
    let guildId;
    let member;

    if (interaction.inGuild()) {
      guildId = interaction.guild.id;
      member = interaction.member;
    } else {
      const resolved = await fetchHomeGuildMember(client, interaction.user.id);
      if (resolved.error) {
        return interaction.reply({ content: resolved.error, ephemeral: true });
      }
      guildId = resolved.guildId;
      member = resolved.member;
    }

    if (!hasPurchaserRole(member)) {
      return denyPurchaserInteraction(interaction);
    }

    const license = licenseService.getLicense(guildId, interaction.user.id);
    const status = licenseService.licenseStatus(license);
    const siteUrl = store.getGuild(guildId).license?.siteUrl || SITE_URL;

    if (!license) {
      return interaction.reply({
        content:
          'You have the buyer role but no license record yet. Contact staff if you recently purchased.',
        ephemeral: true,
      });
    }

    const expiresUnix = Math.floor(status.expiresAt / 1000);
    const embed = virelloEmbed(guildId, {
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
