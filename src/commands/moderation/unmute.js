const { SlashCommandBuilder } = require('discord.js');
const store = require('../../config/store');
const { LEVELS } = require('../../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Remove timeout (mute) from a member')
    .addUserOption((opt) =>
      opt.setName('user').setDescription('Member to unmute').setRequired(true)
    ),
  permissionLevel: LEVELS.staff,
  permissionLabel: 'staff',
  async execute(interaction) {
    const target = interaction.options.getMember('user');
    if (!target) {
      return interaction.reply({ content: 'Could not find that member.', ephemeral: true });
    }

    await target.timeout(null).catch(() => null);
    const config = store.getGuild(interaction.guild.id);
    if (config.roles.muteRoleId) {
      await target.roles.remove(config.roles.muteRoleId).catch(() => null);
    }
    return interaction.reply({ content: `Unmuted **${target.user.tag}**.` });
  },
};
