const store = require('../config/store');

function resolveHomeGuildId(client, userId) {
  if (process.env.GUILD_ID) return process.env.GUILD_ID;

  const guilds = [...client.guilds.cache.values()];
  if (guilds.length === 1) return guilds[0].id;

  for (const guild of guilds) {
    if (store.getLicense(guild.id, userId)) return guild.id;
  }
  for (const guild of guilds) {
    if (store.findOpenTicketByUser(guild.id, userId)) return guild.id;
  }

  return guilds[0]?.id || null;
}

async function fetchHomeGuildMember(client, userId) {
  const guildId = resolveHomeGuildId(client, userId);
  if (!guildId) {
    return { error: 'Server not configured. Contact an administrator.' };
  }

  const guild = await client.guilds.fetch(guildId).catch(() => null);
  if (!guild) {
    return { error: 'Server unavailable. Try again later.' };
  }

  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) {
    return {
      error: 'You must be in the VIRELLO server to use this command.',
    };
  }

  return { guildId, guild, member };
}

module.exports = {
  resolveHomeGuildId,
  fetchHomeGuildMember,
};
