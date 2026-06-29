const { SlashCommandBuilder } = require('discord.js');
const shoppexApi = require('../services/shoppexApi');
const shoppexFulfillment = require('../services/shoppexFulfillment');
const { virelloEmbed } = require('../utils/ticketUi');
const { withLogoPayload } = require('../utils/brand');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('claim')
    .setDescription('Claim your VIRELLO access after a Shoppex purchase')
    .addStringOption((option) =>
      option
        .setName('order_id')
        .setDescription('Your Shoppex order / invoice ID from the receipt or order page')
        .setRequired(true)
    ),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    if (!shoppexApi.apiConfigured()) {
      return interaction.editReply({
        content: 'Shoppex claim is not configured yet. Contact staff with your receipt.',
      });
    }

    const orderId = interaction.options.getString('order_id', true).trim();
    const result = await shoppexFulfillment.fulfillFromInvoice(orderId, {
      discordId: interaction.user.id,
      requirePaid: true,
    });

    if (!result.ok) {
      if (result.reason === 'invoice_not_found') {
        return interaction.editReply({
          content:
            'Could not find that order. Copy the **invoice / order ID** from your Shoppex receipt (not your Discord ID) and try again.',
        });
      }
      if (result.reason === 'invoice_not_paid') {
        return interaction.editReply({
          content: 'That order is not marked as paid yet. Wait a minute after payment and try again.',
        });
      }
      if (result.reason === 'discord_id_mismatch') {
        return interaction.editReply({
          content:
            `That order is linked to a different Discord user ID. Use the same account you entered at checkout, or contact staff.`,
        });
      }
      if (result.reason === 'user_not_in_guild') {
        return interaction.editReply({
          content:
            'You must **join the Virello Discord server** before claiming. Join first, then run `/claim` again.',
        });
      }
      return interaction.editReply({
        content: `Could not grant access: ${result.reason || 'unknown error'}. Contact staff with your order ID.`,
      });
    }

    const embed = virelloEmbed(interaction.guildId, {
      title: '◆ Access claimed',
      description: [
        'Your Shoppex payment was verified and your **Access** role + license are now active.',
        '',
        `**Plan:** ${result.planId}`,
        result.expiresAtDiscord ? `**Valid until:** ${result.expiresAtDiscord}` : '',
        '',
        'Open the dashboard and click **Verify Access** with Discord, then use `/scanner guide` for the download.',
        'Check status anytime with `/mylicense`.',
      ]
        .filter(Boolean)
        .join('\n'),
      color: 0x57f287,
    });

    return interaction.editReply(withLogoPayload({ embeds: [embed] }));
  },
};
