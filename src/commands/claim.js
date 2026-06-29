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
    const invoice = await shoppexApi.fetchInvoice(orderId);
    if (!invoice) {
      return interaction.editReply({
        content:
          'Could not find that order. Copy the **invoice / order ID** from your Shoppex receipt (not your Discord ID) and try again.',
      });
    }

    if (!shoppexApi.invoiceIsPaid(invoice)) {
      return interaction.editReply({
        content: 'That order is not marked as paid yet. Wait a minute after payment and try again.',
      });
    }

    const invoiceDiscordId = shoppexApi.extractDiscordId(invoice);
    const userId = interaction.user.id;

    if (invoiceDiscordId && invoiceDiscordId !== userId) {
      return interaction.editReply({
        content:
          `That order is linked to a different Discord user ID (**${invoiceDiscordId}**). ` +
          'Use the same account you entered at checkout, or contact staff.',
      });
    }

    const planId = shoppexApi.planIdFromInvoice(invoice);
    if (!planId) {
      return interaction.editReply({
        content:
          'Payment found, but the plan could not be matched. Contact staff with your order ID and receipt.',
      });
    }

    const invoiceUniqid = String(invoice.uniqid || invoice.id || orderId).trim();
    const result = await shoppexFulfillment.fulfillShoppexPurchase({
      discordId: userId,
      planId,
      invoiceId: invoiceUniqid,
    });

    if (!result.ok) {
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
        `**Plan:** ${planId}`,
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
