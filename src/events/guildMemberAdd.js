const store = require('../config/store');
const { trySendUserDm } = require('../utils/dm');
const { SITE_URL } = require('../constants/plans');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  name: 'guildMemberAdd',
  async execute(member) {
    const config = store.getGuild(member.guild.id);
    const roleId = config.roles.autoRoleId;
    if (roleId) {
      const role = member.guild.roles.cache.get(roleId);
      if (role) {
        await member.roles.add(role, 'Auto-role on join').catch((err) => {
          console.warn(`Auto-role failed for ${member.id}:`, err.message);
        });
      }
    }

    const joinConfig = config.onJoin || {};
    if (joinConfig.welcomeDmEnabled === false) return;

    const siteUrl = config.license?.siteUrl || SITE_URL;
    const template =
      joinConfig.welcomeDm ||
      'Welcome to **VIRELLO**, {user}! Read the rules and open a **Purchase** panel when you\'re ready.\n\nSite: {site}';

    const text = template
      .replace(/\{user\}/g, member.user.username)
      .replace(/\{site\}/g, siteUrl)
      .replace(/\{server\}/g, member.guild.name);

    const embed = new EmbedBuilder()
      .setColor(0xd40000)
      .setTitle('◆ Welcome to VIRELLO')
      .setDescription(text)
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setLabel('Open website').setStyle(ButtonStyle.Link).setURL(siteUrl)
    );

    await trySendUserDm(member.client, member.id, { embeds: [embed], components: [row] });
  },
};
