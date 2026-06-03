const { SlashCommandBuilder } = require('discord.js');
const { LEVELS } = require('../../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a member from the server')
    .addUserOption((opt) =>
      opt.setName('user').setDescription('Member to ban').setRequired(true)
    )
    .addStringOption((opt) => opt.setName('reason').setDescription('Reason for the ban')),
  permissionLevel: LEVELS.staff,
  permissionLabel: 'staff',
  async execute(interaction) {
    const target = interaction.options.getMember('user');
    if (!target) {
      return interaction.reply({ content: 'Could not find that member.', ephemeral: true });
    }

    if (!target.bannable) {
      return interaction.reply({
        content: 'I cannot ban this member (role hierarchy or permissions).',
        ephemeral: true,
      });
    }

    const reason = interaction.options.getString('reason') || `Banned by ${interaction.user.tag}`;
    await target.ban({ reason });
    return interaction.reply({ content: `Banned **${target.user.tag}**. Reason: ${reason}` });
  },
};
