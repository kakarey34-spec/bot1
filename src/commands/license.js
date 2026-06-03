const { SlashCommandBuilder } = require('discord.js');
const licenseService = require('../services/licenseService');
const { upsertBuyerRegistry } = require('../utils/buyerRegistry');
const { LEVELS } = require('../utils/permissions');
const { trySendUserDm } = require('../utils/dm');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('license')
    .setDescription('Manage VIRELLO buyer licenses (staff)')
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
          `Months since purchase: ${status.monthsSincePurchase}`,
        ].join('\n'),
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
