const { SlashCommandBuilder } = require('discord.js');
const store = require('../../config/store');
const { LEVELS } = require('../../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Timeout (mute) a member')
    .addUserOption((opt) =>
      opt.setName('user').setDescription('Member to mute').setRequired(true)
    )
    .addIntegerOption((opt) =>
      opt
        .setName('minutes')
        .setDescription('Duration in minutes (default from server config)')
        .setMinValue(1)
        .setMaxValue(40320)
    )
    .addStringOption((opt) => opt.setName('reason').setDescription('Reason for the mute')),
  permissionLevel: LEVELS.staff,
  permissionLabel: 'staff',
  async execute(interaction) {
    const target = interaction.options.getMember('user');
    if (!target) {
      return interaction.reply({ content: 'Could not find that member.', ephemeral: true });
    }

    const config = store.getGuild(interaction.guild.id);
    const minutes =
      interaction.options.getInteger('minutes') || config.moderation.muteDurationMinutes || 10;
    const ms = Math.min(Math.max(minutes, 1), 40320) * 60 * 1000;
    const reason = interaction.options.getString('reason') || `Muted by ${interaction.user.tag}`;

    if (!target.moderatable) {
      return interaction.reply({ content: 'I cannot mute this member.', ephemeral: true });
    }

    await target.timeout(ms, reason);

    if (config.roles.muteRoleId) {
      await target.roles.add(config.roles.muteRoleId).catch(() => null);
    }

    return interaction.reply({
      content: `Muted **${target.user.tag}** for ${minutes} minute(s).`,
    });
  },
};
