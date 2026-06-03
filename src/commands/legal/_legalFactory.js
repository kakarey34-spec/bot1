const { SlashCommandBuilder } = require('discord.js');
const { LEVELS } = require('../../utils/permissions');
const { buildLegalEmbed } = require('../../utils/legalUi');

const LABELS = {
  rules: 'Server Rules',
  terms: 'Terms of Service',
  buyerterms: 'Buyer Terms',
  privacypolicy: 'Privacy Policy',
};

function createLegalCommand(name, description, docKey) {
  return {
    data: new SlashCommandBuilder().setName(name).setDescription(description),
    permissionLevel: LEVELS.owner,
    permissionLabel: 'server owner',
    async execute(interaction) {
      await interaction.deferReply({ ephemeral: true });

      try {
        await interaction.channel.send(buildLegalEmbed(interaction.guild.id, docKey));
      } catch (err) {
        console.error(`/${name} error:`, err);
        return interaction.editReply({
          content: 'Could not post the document. Check bot permissions in this channel.',
        });
      }

      return interaction.editReply({
        content: `**${LABELS[docKey] || name}** posted in ${interaction.channel}.`,
      });
    },
  };
}

module.exports = createLegalCommand;
