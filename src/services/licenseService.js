const store = require('../config/store');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { trySendUserDm } = require('../utils/dm');
const { RENEWAL_OPEN_PREFIX } = require('../utils/components');
const { getPlan, addMonthsMs, formatPlanLabel, SITE_URL } = require('../constants/plans');

function licenseKey(guildId, userId) {
  return `${guildId}:${userId}`;
}

function getLicense(guildId, userId) {
  return store.getLicense(guildId, userId);
}

function grantLicense(guildId, userId, planId, meta = {}) {
  const plan = getPlan(planId);
  if (!plan) return { error: 'Invalid plan.' };

  const existing = getLicense(guildId, userId);
  const now = Date.now();
  const base =
    existing && existing.expiresAt > now && !existing.expired ? existing.expiresAt : now;
  const expiresAt = addMonthsMs(base, plan.months);

  const record = {
    guildId,
    userId,
    planId,
    months: plan.months,
    approvedAt: meta.approvedAt || now,
    expiresAt,
    approvedBy: meta.approvedBy || null,
    ticketChannelId: meta.ticketChannelId || null,
    paymentSource: meta.paymentSource || existing?.paymentSource || null,
    shoppexInvoiceId: meta.shoppexInvoiceId || existing?.shoppexInvoiceId || null,
    expired: false,
    warningsSent: existing?.warningsSent || [],
    registryMessageId: existing?.registryMessageId || null,
  };

  store.setLicense(guildId, userId, record);
  return { ok: true, license: record, plan };
}

function markLicenseExpired(guildId, userId) {
  const license = getLicense(guildId, userId);
  if (!license) return null;
  license.expired = true;
  license.expiredAt = Date.now();
  store.setLicense(guildId, userId, license);
  return license;
}

function monthsElapsedSince(approvedAt) {
  const start = new Date(approvedAt);
  const now = new Date();
  return (
    (now.getFullYear() - start.getFullYear()) * 12 +
    (now.getMonth() - start.getMonth()) +
    (now.getDate() < start.getDate() ? -1 : 0)
  );
}

function licenseStatus(license) {
  if (!license) return { active: false, expired: true };
  const now = Date.now();
  const expired = license.expired || now >= license.expiresAt;
  const msLeft = license.expiresAt - now;
  const daysLeft = Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000)));
  const monthsSincePurchase = monthsElapsedSince(license.approvedAt);

  return {
    active: !expired,
    expired,
    expiresAt: license.expiresAt,
    daysLeft,
    monthsSincePurchase,
    monthsTotal: license.months,
    planId: license.planId,
    planLabel: formatPlanLabel(license.planId),
  };
}

async function sendWelcomeDm(guild, userId, license, plan) {
  const config = store.getGuild(guild.id);
  const siteUrl = config.license?.siteUrl || SITE_URL;
  const expiresUnix = Math.floor(license.expiresAt / 1000);

  const embed = new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle('◆ VIRELLO — Access granted')
    .setDescription(
      [
        'Your payment was approved and your license is now **active**.',
        '',
        '**Next steps**',
        '1. Join the Discord server (if you have not already).',
        '2. Open the dashboard and click **Verify Access** with Discord.',
        '3. Generate a PIN, then run `/scanner guide` for the download link.',
        '4. Enter the PIN in the scanner and wait for the report to upload.',
        '',
        'Use `/mylicense` anytime to check your status.',
      ].join('\n')
    )
    .addFields(
      { name: 'Plan', value: plan.label, inline: true },
      { name: 'Valid until', value: `<t:${expiresUnix}:F>`, inline: true },
      { name: 'Dashboard', value: siteUrl, inline: false }
    )
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setLabel('Open dashboard').setStyle(ButtonStyle.Link).setURL(siteUrl)
  );

  const payload = { embeds: [embed], components: [row] };
  return trySendUserDm(guild.client, userId, payload);
}

function renewalDmButton(guildId) {
  const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${RENEWAL_OPEN_PREFIX}${guildId}`)
      .setLabel('Open renewal lane')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🔄')
  );
}

async function sendExpiryWarningDm(client, user, guildId, license, daysLeft) {
  const plan = getPlan(license.planId);
  const config = store.getGuild(guildId);
  const siteUrl = config.license?.siteUrl || SITE_URL;
  const expiresUnix = Math.floor(license.expiresAt / 1000);

  const embed = new EmbedBuilder()
    .setColor(0xf59e0b)
    .setTitle('◆ VIRELLO — License expiring soon')
    .setDescription(
      `Your **${plan?.label || 'license'}** expires in **${daysLeft} day(s)**.\n\nRenew now to avoid losing buyer access and scanner privileges.`
    )
    .addFields(
      { name: 'Expires', value: `<t:${expiresUnix}:F>`, inline: true },
      { name: 'Plan', value: plan?.label || license.planId, inline: true },
      { name: 'Website', value: siteUrl, inline: false }
    )
    .setFooter({ text: 'Use the button below to open a private renewal lane' })
    .setTimestamp();

  const row = renewalDmButton(guildId);
  const linkRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setLabel('Open VIRELLO').setStyle(ButtonStyle.Link).setURL(siteUrl)
  );

  return trySendUserDm(client, user.id, {
    embeds: [embed],
    components: [row, linkRow],
  });
}

async function sendExpiredDm(client, user, guildId, license) {
  const plan = getPlan(license.planId);
  const embed = new EmbedBuilder()
    .setColor(0xdc2626)
    .setTitle('◆ VIRELLO — License expired')
    .setDescription(
      `Your **${plan?.label || 'license'}** has ended and buyer access was removed.\n\nRenew to restore access.`
    )
    .setTimestamp();

  return trySendUserDm(client, user.id, {
    embeds: [embed],
    components: [renewalDmButton(guildId)],
  });
}

async function revokeLicense(guild, userId, staffId, reason = null) {
  const license = getLicense(guild.id, userId);
  if (!license) {
    return { error: 'That user has no license record.' };
  }

  license.expired = true;
  license.expiredAt = Date.now();
  license.revokedBy = staffId;
  license.revokeReason = reason;
  store.setLicense(guild.id, userId, license);

  await removePurchaserRole(guild, userId, 'License revoked by staff');
  return { ok: true, license };
}

async function addPurchaserRole(guild, userId, auditReason = 'License granted') {
  const config = store.getGuild(guild.id);
  if (!config.roles.purchaserRoleId) return;
  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) return;
  await member.roles.add(config.roles.purchaserRoleId, auditReason).catch(() => null);
}

async function grantLicenseToUser(
  guild,
  userId,
  planId,
  staffId,
  { notify = true, promo = null, paymentSource = null, shoppexInvoiceId = null } = {}
) {
  const result = grantLicense(guild.id, userId, planId, {
    approvedBy: staffId,
    approvedAt: Date.now(),
    grantedByStaff: true,
    paymentSource,
    shoppexInvoiceId,
  });
  if (result.error) return result;

  if (promo) {
    const promoService = require('./promoService');
    promoService.applyPromoToLicense(result.license, promo);
    store.setLicense(guild.id, userId, result.license);
    promoService.consumePromo(guild.id, promo.code);
  }

  await addPurchaserRole(guild, userId, 'License granted by staff');
  if (notify) {
    await sendWelcomeDm(guild, userId, result.license, result.plan);
  }
  return result;
}

async function extendLicense(guild, userId, months, staffId) {
  if (!Number.isInteger(months) || months < 1 || months > 36) {
    return { error: 'Months must be between 1 and 36.' };
  }

  const license = getLicense(guild.id, userId);
  if (!license) {
    return { error: 'That user has no license record. Use `/license grant` first.' };
  }

  const now = Date.now();
  const base = license.expiresAt > now && !license.expired ? license.expiresAt : now;
  license.expiresAt = addMonthsMs(base, months);
  license.expired = false;
  license.extendedBy = staffId;
  license.extendedAt = now;
  license.warningsSent = [];
  store.setLicense(guild.id, userId, license);

  await addPurchaserRole(guild, userId, 'License extended by staff');
  return { ok: true, license, monthsAdded: months };
}

function listLicenses(guildId, { activeOnly = true } = {}) {
  return store
    .listLicensesForGuild(guildId)
    .map((entry) => ({
      ...entry,
      status: licenseStatus(entry),
    }))
    .filter((entry) => (activeOnly ? entry.status.active : true))
    .sort((a, b) => a.expiresAt - b.expiresAt);
}

async function removePurchaserRole(guild, userId, auditReason = 'License expired') {
  const config = store.getGuild(guild.id);
  if (!config.roles.purchaserRoleId) return;
  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) return;
  await member.roles.remove(config.roles.purchaserRoleId, auditReason).catch(() => null);
}

module.exports = {
  getLicense,
  grantLicense,
  grantLicenseToUser,
  extendLicense,
  listLicenses,
  markLicenseExpired,
  revokeLicense,
  licenseStatus,
  sendWelcomeDm,
  sendExpiryWarningDm,
  sendExpiredDm,
  addPurchaserRole,
  removePurchaserRole,
};
