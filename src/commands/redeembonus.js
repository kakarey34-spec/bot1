const {
  SlashCommandBuilder,
  InteractionContextType,
  ModalBuilder,
  ActionRowBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('redeembonus')
    .setDescription('Redeem a bonus license days promo code')
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM),
  async execute(interaction) {
    const modal = new ModalBuilder()
      .setCustomId('redeembonus_modal')
      .setTitle('Redeem bonus days');
    const codeInput = new TextInputBuilder()
      .setCustomId('code')
      .setLabel('Promo code')
      .setPlaceholder('Enter your bonus days code')
      .setStyle(TextInputStyle.Short)
      .setMinLength(3)
      .setMaxLength(32)
      .setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(codeInput));
    return interaction.showModal(modal);
  },
};
