const licenseService = require('./licenseService');
const { upsertBuyerRegistry } = require('../utils/buyerRegistry');

let clientRef = null;

function setClient(client) {
  clientRef = client;
}

function resolveGuildId() {
  return (
    process.env.GUILD_ID ||
    process.env.DISCORD_GUILD_ID ||
    ''
  ).trim();
}

async function getGuild() {
  const guildId = resolveGuildId();
  if (!guildId || !clientRef) return null;
  return clientRef.guilds.fetch(guildId).catch(() => null);
}

async function fulfillShoppexPurchase({ discordId, planId, invoiceId }) {
  const normalizedId = String(discordId || '').trim();

  if (!resolveGuildId() || !clientRef) {
    return { ok: false, reason: 'not_configured' };
  }
  if (!/^\d{17,20}$/.test(normalizedId)) {
    return { ok: false, reason: 'invalid_discord_id' };
  }
  if (!planId) {
    return { ok: false, reason: 'missing_plan_id' };
  }

  const guild = await getGuild();
  if (!guild) {
    return { ok: false, reason: 'guild_not_found' };
  }

  const member = await guild.members.fetch(normalizedId).catch(() => null);
  if (!member) {
    return {
      ok: false,
      reason: 'user_not_in_guild',
      detail: 'Join the Virello Discord server before checkout, then contact staff if you already paid.',
    };
  }

  const result = await licenseService.grantLicenseToUser(guild, normalizedId, planId, 'shoppex', {
    notify: true,
    paymentSource: 'shoppex',
    shoppexInvoiceId: invoiceId || null,
  });
  if (result.error) {
    return { ok: false, reason: result.error };
  }

  await upsertBuyerRegistry(guild, normalizedId, result.license);
  const expiresUnix = Math.floor(result.license.expiresAt / 1000);
  console.log(
    `[shoppex] License active for ${normalizedId} plan=${planId} until ${new Date(result.license.expiresAt).toISOString()} invoice=${invoiceId || 'n/a'}`
  );
  return {
    ok: true,
    planId,
    discordId: normalizedId,
    invoiceId: invoiceId || null,
    expiresAt: result.license.expiresAt,
    expiresAtDiscord: `<t:${expiresUnix}:F>`,
  };
}

async function revokeShoppexPurchase({ discordId, reason = 'Shoppex subscription ended' }) {
  const normalizedId = String(discordId || '').trim();
  const guild = await getGuild();
  if (!guild) {
    return { ok: false, reason: 'guild_not_found' };
  }

  const result = await licenseService.revokeLicense(guild, normalizedId, 'shoppex', reason);
  if (result.error) {
    return { ok: false, reason: result.error };
  }

  await upsertBuyerRegistry(guild, normalizedId, result.license);
  console.log(`[shoppex] Revoked license for ${normalizedId}: ${reason}`);
  return { ok: true, discordId: normalizedId };
}

module.exports = {
  setClient,
  fulfillShoppexPurchase,
  revokeShoppexPurchase,
};
