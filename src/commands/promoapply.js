const { SlashCommandBuilder, InteractionContextType } = require('discord.js');
const ticketManager = require('../services/ticketManager');
const { fetchHomeGuildMember } = require('../utils/guildContext');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('promoapply')
    .setDescription('Apply a promo code to your open purchase or renewal ticket')
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM)
    .addStringOption((opt) =>
      opt.setName('code').setDescription('Promo code').setRequired(true).setMaxLength(32)
    ),
  async execute(interaction, client) {
    const code = interaction.options.getString('code');
    await interaction.deferReply({ ephemeral: true });

    let guildId;
    if (interaction.inGuild()) {
      guildId = interaction.guild.id;
    } else {
      const resolved = await fetchHomeGuildMember(client, interaction.user.id);
      if (resolved.error) {
        return interaction.editReply({ content: resolved.error });
      }
      guildId = resolved.guildId;
    }

    const result = await ticketManager.applyPromoForUser(client, guildId, interaction.user.id, code);
    if (result.error) {
      return interaction.editReply({ content: result.error });
    }

    return interaction.editReply({
      content: `Promo **${result.promo.code}** applied. Check ${result.channel} for the amount you need to send.`,
    });
  },
};
