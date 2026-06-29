const licenseService = require('./licenseService');
const { upsertBuyerRegistry } = require('../utils/buyerRegistry');

let clientRef = null;

function setClient(client) {
  clientRef = client;
}

async function fulfillShoppexPurchase({ discordId, planId, invoiceId }) {
  const guildId = process.env.GUILD_ID || process.env.DISCORD_GUILD_ID || '';
  const normalizedId = String(discordId || '').trim();

  if (!guildId || !clientRef) {
    return { ok: false, reason: 'not_configured' };
  }
  if (!/^\d{17,20}$/.test(normalizedId)) {
    return { ok: false, reason: 'invalid_discord_id' };
  }
  if (!planId) {
    return { ok: false, reason: 'missing_plan_id' };
  }

  const guild = await clientRef.guilds.fetch(guildId).catch(() => null);
  if (!guild) {
    return { ok: false, reason: 'guild_not_found' };
  }

  const member = await guild.members.fetch(normalizedId).catch(() => null);
  if (!member) {
    return {
      ok: false,
      reason: 'user_not_in_guild',
      detail: 'Buyer must join the Virello Discord server before checkout.',
    };
  }

  const result = await licenseService.grantLicenseToUser(guild, normalizedId, planId, 'shoppex', {
    notify: true,
  });
  if (result.error) {
    return { ok: false, reason: result.error };
  }

  await upsertBuyerRegistry(guild, normalizedId, result.license);
  console.log(
    `[shoppex] Granted license for ${normalizedId} plan=${planId} invoice=${invoiceId || 'n/a'}`
  );
  return { ok: true, planId, discordId: normalizedId, invoiceId: invoiceId || null };
}

module.exports = {
  setClient,
  fulfillShoppexPurchase,
};
