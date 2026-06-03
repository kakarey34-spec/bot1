const { SlashCommandBuilder } = require('discord.js');
const { LEVELS } = require('../../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a member from the server')
    .addUserOption((opt) =>
      opt.setName('user').setDescription('Member to kick').setRequired(true)
    )
    .addStringOption((opt) => opt.setName('reason').setDescription('Reason for the kick')),
  permissionLevel: LEVELS.staff,
  permissionLabel: 'staff',
  async execute(interaction) {
    const target = interaction.options.getMember('user');
    if (!target) {
      return interaction.reply({ content: 'Could not find that member.', ephemeral: true });
    }

    if (!target.kickable) {
      return interaction.reply({
        content: 'I cannot kick this member (role hierarchy or permissions).',
        ephemeral: true,
      });
    }

    const reason = interaction.options.getString('reason') || `Kicked by ${interaction.user.tag}`;
    await target.kick(reason);
    return interaction.reply({ content: `Kicked **${target.user.tag}**. Reason: ${reason}` });
  },
};
