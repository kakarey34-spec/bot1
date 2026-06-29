const licenseService = require('./licenseService');
const shoppexApi = require('./shoppexApi');
const store = require('../config/store');
const { upsertBuyerRegistry } = require('../utils/buyerRegistry');

let clientRef = null;

function setClient(client) {
  clientRef = client;
}

function resolveGuildId() {
  return (
    process.env.GUILD_ID ||
    process.env.DISCORD_GUILD_ID ||
    '1510614253508493373'
  ).trim();
}

async function getGuild() {
  const guildId = resolveGuildId();
  if (!guildId || !clientRef) return null;
  return clientRef.guilds.fetch(guildId).catch(() => null);
}

function resolveAccessRoleId(guildId) {
  const fromEnv = (process.env.DISCORD_ACCESS_ROLE_ID || '').trim();
  if (fromEnv) return fromEnv;
  const config = store.getGuild(guildId);
  return (config.roles.purchaserRoleId || '').trim() || null;
}

async function grantAccessRole(guild, userId, reason = 'Shoppex purchase verified') {
  const roleId = resolveAccessRoleId(guild.id);
  if (!roleId) {
    return { ok: false, reason: 'access_role_not_configured' };
  }

  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) {
    return {
      ok: false,
      reason: 'user_not_in_guild',
      detail: 'Join the Virello Discord server before checkout.',
    };
  }

  if (member.roles.cache.has(roleId)) {
    return { ok: true, roleId, alreadyHadRole: true };
  }

  try {
    await member.roles.add(roleId, reason);
    console.log(`[shoppex] Access role ${roleId} granted to ${userId}`);
    return { ok: true, roleId };
  } catch (error) {
    console.error(`[shoppex] Access role grant failed for ${userId}:`, error);
    return { ok: false, reason: 'role_add_failed', detail: String(error.message || error) };
  }
}

async function fulfillFromInvoice(invoiceId, { discordId = null, requirePaid = true } = {}) {
  const normalizedInvoiceId = String(invoiceId || '').trim();
  if (!normalizedInvoiceId) {
    return { ok: false, reason: 'missing_invoice_id' };
  }
  if (!shoppexApi.apiConfigured()) {
    return { ok: false, reason: 'shoppex_api_not_configured' };
  }

  const invoice = await shoppexApi.fetchInvoice(normalizedInvoiceId);
  if (!invoice) {
    return { ok: false, reason: 'invoice_not_found' };
  }
  if (requirePaid && !shoppexApi.invoiceIsPaid(invoice)) {
    return { ok: false, reason: 'invoice_not_paid' };
  }

  const invoiceDiscordId = shoppexApi.extractDiscordId(invoice);
  // Checkout custom field is authoritative — use it before any caller-provided Discord ID.
  const resolvedDiscordId = String(invoiceDiscordId || discordId || '').trim();
  const planId = shoppexApi.planIdFromInvoice(invoice);
  const invoiceUniqid = String(invoice.uniqid || invoice.id || normalizedInvoiceId).trim();

  if (discordId && invoiceDiscordId && discordId !== invoiceDiscordId) {
    return {
      ok: false,
      reason: 'discord_id_mismatch',
      detail: `Invoice is linked to ${invoiceDiscordId}`,
    };
  }
  if (!resolvedDiscordId) {
    return { ok: false, reason: 'missing_discord_id' };
  }
  if (!planId) {
    return { ok: false, reason: 'missing_plan_id' };
  }

  return fulfillShoppexPurchase({
    discordId: resolvedDiscordId,
    planId,
    invoiceId: invoiceUniqid,
  });
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

  const roleResult = await grantAccessRole(guild, normalizedId, 'Shoppex purchase verified');
  if (!roleResult.ok) {
    return roleResult;
  }

  const result = await licenseService.grantLicenseToUser(guild, normalizedId, planId, 'shoppex', {
    notify: true,
    paymentSource: 'shoppex',
    shoppexInvoiceId: invoiceId || null,
  });
  if (result.error) {
    return { ok: false, reason: result.error, discordId: normalizedId, accessRoleId: roleResult.roleId };
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
    accessRoleId: roleResult.roleId || null,
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
  fulfillFromInvoice,
  fulfillShoppexPurchase,
  grantAccessRole,
  revokeShoppexPurchase,
};
