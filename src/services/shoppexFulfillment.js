const licenseService = require('./licenseService');
const shoppexApi = require('./shoppexApi');
const store = require('../config/store');
const { upsertBuyerRegistry } = require('../utils/buyerRegistry');
const { syncLicenseGrant, syncLicenseRevoke } = require('./licenseDashboardSync');

let clientRef = null;
let readyPromise = null;

function setClient(client) {
  clientRef = client;
  readyPromise = new Promise((resolve) => {
    if (client.isReady()) {
      resolve();
      return;
    }
    client.once('clientReady', resolve);
  });
}

async function waitForReady() {
  if (clientRef?.isReady()) return;
  if (readyPromise) await readyPromise;
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
  await waitForReady();
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

async function fulfillFromInvoice(
  invoiceId,
  { discordId = null, planId = null, requirePaid = true, trustPaid = false, customFields = null } = {},
) {
  const normalizedInvoiceId = String(invoiceId || '').trim();
  if (!normalizedInvoiceId) {
    return { ok: false, reason: 'missing_invoice_id' };
  }

  let hintedDiscordId = String(discordId || '').trim();
  let hintedPlanId = String(planId || '').trim();
  if (!hintedDiscordId && customFields) {
    const fromCustom = shoppexApi.extractDiscordId({ custom_fields: customFields });
    if (fromCustom) hintedDiscordId = fromCustom;
  }

  if (trustPaid && hintedDiscordId && hintedPlanId) {
    return registerShoppexPurchase({
      discordId: hintedDiscordId,
      planId: hintedPlanId,
      invoiceId: normalizedInvoiceId,
    });
  }

  if (shoppexApi.apiConfigured()) {
    const invoice = await shoppexApi.fetchInvoice(normalizedInvoiceId);
    if (invoice) {
      if (requirePaid && !trustPaid && !shoppexApi.invoiceIsPaid(invoice)) {
        return { ok: false, reason: 'invoice_not_paid' };
      }

      const invoiceDiscordId = shoppexApi.extractDiscordId(invoice);
      const resolvedDiscordId = String(invoiceDiscordId || hintedDiscordId || '').trim();
      const resolvedPlanId = shoppexApi.planIdFromInvoice(invoice) || hintedPlanId || '';
      const invoiceUniqid = String(invoice.uniqid || invoice.id || normalizedInvoiceId).trim();

      if (hintedDiscordId && invoiceDiscordId && hintedDiscordId !== invoiceDiscordId) {
        return {
          ok: false,
          reason: 'discord_id_mismatch',
          detail: `Invoice is linked to ${invoiceDiscordId}`,
        };
      }
      if (resolvedDiscordId && resolvedPlanId) {
        return registerShoppexPurchase({
          discordId: resolvedDiscordId,
          planId: resolvedPlanId,
          invoiceId: invoiceUniqid,
        });
      }
      hintedDiscordId = resolvedDiscordId || hintedDiscordId;
      hintedPlanId = resolvedPlanId || hintedPlanId;
    } else if (!trustPaid) {
      return { ok: false, reason: 'invoice_not_found' };
    }
  }

  if (trustPaid && hintedDiscordId && hintedPlanId) {
    return registerShoppexPurchase({
      discordId: hintedDiscordId,
      planId: hintedPlanId,
      invoiceId: normalizedInvoiceId,
    });
  }

  if (!hintedDiscordId) return { ok: false, reason: 'missing_discord_id' };
  if (!hintedPlanId) return { ok: false, reason: 'missing_plan_id' };
  if (!shoppexApi.apiConfigured()) return { ok: false, reason: 'shoppex_api_not_configured' };
  return { ok: false, reason: 'invoice_not_found' };
}

async function registerShoppexPurchase({ discordId, planId, invoiceId }) {
  const normalizedId = String(discordId || '').trim();

  if (!resolveGuildId() || !clientRef) {
    return { ok: false, reason: 'not_configured' };
  }
  await waitForReady();

  if (!/^\d{17,20}$/.test(normalizedId)) {
    return { ok: false, reason: 'invalid_discord_id' };
  }
  if (!planId) {
    return { ok: false, reason: 'missing_plan_id' };
  }

  const plan = require('../constants/plans').getPlan(planId);
  if (!plan) {
    return { ok: false, reason: 'invalid_plan', detail: `Unknown plan: ${planId}` };
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

  const licenseResult = licenseService.grantLicense(guild.id, normalizedId, planId, {
    approvedBy: 'shoppex',
    approvedAt: Date.now(),
    paymentSource: 'shoppex',
    shoppexInvoiceId: invoiceId || null,
  });
  if (licenseResult.error) {
    return { ok: false, reason: licenseResult.error, discordId: normalizedId, accessRoleId: roleResult.roleId };
  }

  const { license } = licenseResult;
  await upsertBuyerRegistry(guild, normalizedId, license);
  await licenseService.sendWelcomeDm(guild, normalizedId, license, licenseResult.plan);

  const expiresUnix = Math.floor(license.expiresAt / 1000);
  console.log(
    `[shoppex] Registered purchase for ${normalizedId} plan=${planId} until ${new Date(license.expiresAt).toISOString()} invoice=${invoiceId || 'n/a'}`,
  );

  void syncLicenseGrant({
    discordId: normalizedId,
    planId,
    invoiceId: invoiceId || null,
    expiresAt: license.expiresAt,
  });

  return {
    ok: true,
    planId,
    discordId: normalizedId,
    invoiceId: invoiceId || null,
    accessRoleId: roleResult.roleId || null,
    expiresAt: license.expiresAt,
    expires_at: license.expiresAt,
    expiresAtDiscord: `<t:${expiresUnix}:F>`,
  };
}

async function fulfillShoppexPurchase(args) {
  return registerShoppexPurchase(args);
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
  void syncLicenseRevoke({ discordId: normalizedId, reason });
  return { ok: true, discordId: normalizedId };
}

module.exports = {
  setClient,
  fulfillFromInvoice,
  fulfillShoppexPurchase,
  registerShoppexPurchase,
  grantAccessRole,
  revokeShoppexPurchase,
};
