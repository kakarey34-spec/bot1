const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const licenseService = require('../services/licenseService');
const { upsertBuyerRegistry } = require('../utils/buyerRegistry');
const { LEVELS } = require('../utils/permissions');
const { trySendUserDm } = require('../utils/dm');
const { listPlans } = require('../constants/plans');

const PLAN_CHOICES = listPlans().map((p) => ({ name: p.label, value: p.id }));

module.exports = {
  data: new SlashCommandBuilder()
    .setName('license')
    .setDescription('Manage VIRELLO buyer licenses (staff)')
    .addSubcommand((sub) =>
      sub
        .setName('grant')
        .setDescription('Grant a license and buyer role without a ticket')
        .addUserOption((opt) =>
          opt.setName('user').setDescription('User to grant').setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName('plan')
            .setDescription('License plan')
            .setRequired(true)
            .addChoices(...PLAN_CHOICES)
        )
        .addBooleanOption((opt) =>
          opt.setName('notify').setDescription('Send welcome DM (default: yes)')
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('extend')
        .setDescription('Add time to an existing license')
        .addUserOption((opt) =>
          opt.setName('user').setDescription('User to extend').setRequired(true)
        )
        .addIntegerOption((opt) =>
          opt
            .setName('months')
            .setDescription('Months to add (1–36)')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(36)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('list')
        .setDescription('List buyer licenses')
        .addBooleanOption((opt) =>
          opt.setName('include_expired').setDescription('Include expired/revoked licenses')
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('revoke')
        .setDescription('End a user\'s license and remove buyer access')
        .addUserOption((opt) =>
          opt.setName('user').setDescription('Buyer to revoke').setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName('reason').setDescription('Reason shown to the user (optional)')
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('check')
        .setDescription('Check a user\'s license record (staff)')
        .addUserOption((opt) =>
          opt.setName('user').setDescription('User to check').setRequired(true)
        )
    ),
  permissionLevel: LEVELS.staff,
  permissionLabel: 'staff',
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'list') {
      const includeExpired = interaction.options.getBoolean('include_expired') ?? false;
      const entries = licenseService.listLicenses(interaction.guild.id, {
        activeOnly: !includeExpired,
      });

      if (!entries.length) {
        return interaction.reply({
          content: includeExpired ? 'No license records found.' : 'No active licenses found.',
          ephemeral: true,
        });
      }

      const lines = entries.slice(0, 25).map((entry) => {
        const expiresUnix = Math.floor(entry.expiresAt / 1000);
        const icon = entry.status.active ? '🟢' : '🔴';
        return `${icon} <@${entry.userId}> — **${entry.status.planLabel}** — ${entry.status.daysLeft}d left — expires <t:${expiresUnix}:D>`;
      });

      const embed = new EmbedBuilder()
        .setColor(0xd40000)
        .setTitle(includeExpired ? '◆ All licenses' : '◆ Active licenses')
        .setDescription(lines.join('\n').slice(0, 4000))
        .setFooter({ text: `Showing ${Math.min(entries.length, 25)} of ${entries.length}` })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const target = interaction.options.getUser('user');

    if (sub === 'check') {
      const license = licenseService.getLicense(interaction.guild.id, target.id);
      if (!license) {
        return interaction.reply({
          content: `No license record for ${target.tag}.`,
          ephemeral: true,
        });
      }
      const status = licenseService.licenseStatus(license);
      const expiresUnix = Math.floor(license.expiresAt / 1000);
      return interaction.reply({
        content: [
          `**${target.tag}**`,
          `Plan: ${status.planLabel}`,
          `Status: ${status.active ? '🟢 Active' : '🔴 Expired/revoked'}`,
          `Purchased: <t:${Math.floor(license.approvedAt / 1000)}:F>`,
          `Expires: <t:${expiresUnix}:F>`,
          `Days left: ${status.daysLeft}`,
          `Months since purchase: ${status.monthsSincePurchase}`,
        ].join('\n'),
        ephemeral: true,
      });
    }

    if (sub === 'grant') {
      const planId = interaction.options.getString('plan');
      const notify = interaction.options.getBoolean('notify') ?? true;
      const result = await licenseService.grantLicenseToUser(
        interaction.guild,
        target.id,
        planId,
        interaction.user.id,
        { notify }
      );

      if (result.error) {
        return interaction.reply({ content: result.error, ephemeral: true });
      }

      await upsertBuyerRegistry(interaction.guild, target.id, result.license);
      const expiresUnix = Math.floor(result.license.expiresAt / 1000);

      return interaction.reply({
        content: `Granted **${result.plan.label}** to **${target.tag}**. Expires <t:${expiresUnix}:F>.`,
        ephemeral: true,
      });
    }

    if (sub === 'extend') {
      const months = interaction.options.getInteger('months');
      const result = await licenseService.extendLicense(
        interaction.guild,
        target.id,
        months,
        interaction.user.id
      );

      if (result.error) {
        return interaction.reply({ content: result.error, ephemeral: true });
      }

      await upsertBuyerRegistry(interaction.guild, target.id, result.license);
      const expiresUnix = Math.floor(result.license.expiresAt / 1000);

      await trySendUserDm(interaction.client, target.id, {
        content: `**VIRELLO license extended** — **${months} month(s)** added.\nNew expiry: <t:${expiresUnix}:F>`,
      });

      return interaction.reply({
        content: `Extended **${target.tag}** by **${months}** month(s). New expiry: <t:${expiresUnix}:F>.`,
        ephemeral: true,
      });
    }

    if (sub === 'revoke') {
      const reason = interaction.options.getString('reason')?.trim() || null;
      const result = await licenseService.revokeLicense(
        interaction.guild,
        target.id,
        interaction.user.id,
        reason
      );

      if (result.error) {
        return interaction.reply({ content: result.error, ephemeral: true });
      }

      await upsertBuyerRegistry(interaction.guild, target.id, result.license);

      const dmText = [
        '**VIRELLO license ended**',
        'Your buyer access has been removed by staff.',
        reason ? `\n**Reason:** ${reason}` : '',
        '\nContact support if you believe this is a mistake.',
      ].join('');

      await trySendUserDm(interaction.client, target.id, { content: dmText });

      return interaction.reply({
        content: `License revoked for **${target.tag}**. Buyer role removed.`,
        ephemeral: true,
      });
    }
  },
};
