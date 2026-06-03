const store = require('../config/store');

module.exports = {
  name: 'guildMemberAdd',
  async execute(member) {
    const config = store.getGuild(member.guild.id);
    const roleId = config.roles.autoRoleId;
    if (!roleId) return;

    const role = member.guild.roles.cache.get(roleId);
    if (!role) return;

    await member.roles.add(role, 'Auto-role on join').catch((err) => {
      console.warn(`Auto-role failed for ${member.id}:`, err.message);
    });
  },
};
