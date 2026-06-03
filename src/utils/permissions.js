const store = require('../config/store');

const LEVELS = {
  everyone: 0,
  staff: 1,
  admin: 2,
  config: 3,
  owner: 4,
};

function memberHasRole(member, roleIds) {
  if (!roleIds?.length) return false;
  return roleIds.some((id) => member.roles.cache.has(id));
}

function isWhitelistedUser(guildId, userId) {
  const config = store.getGuild(guildId);
  return config.whitelist.userIds.includes(userId);
}

function getPermissionLevel(member) {
  if (!member) return LEVELS.everyone;
  if (member.guild.ownerId === member.id) return LEVELS.owner;
  const config = store.getGuild(member.guild.id);

  if (isWhitelistedUser(member.guild.id, member.id)) return LEVELS.config;

  if (memberHasRole(member, config.whitelist.configRoleIds)) return LEVELS.config;
  if (memberHasRole(member, config.whitelist.adminRoleIds)) return LEVELS.admin;
  if (
    memberHasRole(member, config.whitelist.staffRoleIds) ||
    memberHasRole(member, config.roles.staffRoleIds)
  ) {
    return LEVELS.staff;
  }
  return LEVELS.everyone;
}

function canUse(member, requiredLevel) {
  return getPermissionLevel(member) >= requiredLevel;
}

function hasPurchaserRole(member) {
  if (!member) return false;
  const config = store.getGuild(member.guild.id);
  const roleId = config.roles.purchaserRoleId;
  return roleId ? member.roles.cache.has(roleId) : false;
}

function denyPurchaserInteraction(interaction) {
  const payload = {
    content:
      'You need an active **buyer** role to use this command. Purchase or renew access first.',
    ephemeral: true,
  };
  if (interaction.replied || interaction.deferred) {
    return interaction.editReply(payload);
  }
  return interaction.reply(payload);
}

function denyReply(message, levelName = 'authorized staff') {
  return message.reply({
    content: `You do not have permission to use this command. This action requires **${levelName}** access.`,
    allowedMentions: { repliedUser: false },
  });
}

function denyInteraction(interaction, levelName = 'authorized staff') {
  const payload = {
    content: `You do not have permission to use this command. This action requires **${levelName}** access.`,
    ephemeral: true,
  };
  if (interaction.replied || interaction.deferred) {
    return interaction.editReply(payload);
  }
  return interaction.reply(payload);
}

module.exports = {
  LEVELS,
  getPermissionLevel,
  canUse,
  hasPurchaserRole,
  denyReply,
  denyInteraction,
  denyPurchaserInteraction,
  isWhitelistedUser,
  memberHasRole,
};
