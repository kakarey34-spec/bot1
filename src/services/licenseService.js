const store = require('../config/store');
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
    expired: false,
    warningsSent: existing?.warningsSent || [],
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

async function sendWelcomeDm(member, guildId, license, plan) {
  const config = store.getGuild(guildId);
  const siteUrl = config.license?.siteUrl || SITE_URL;
  const template =
    config.license?.welcomeDm ||
    '**Access granted.** Your VIRELLO license is active.\n\n**Plan:** {plan}\n**Valid until:** {expires}\n\nOpen the site: {site}\nUse `/mylicense` anytime to check your status.';

  const expires = new Date(license.expiresAt).toUTCString();
  const text = template
    .replace(/\{plan\}/g, plan.label)
    .replace(/\{expires\}/g, expires)
    .replace(/\{site\}/g, siteUrl);

  await member.user
    .send({ content: text })
    .catch(() => null);
}

async function sendExpiryWarningDm(user, guildId, license, daysLeft) {
  const plan = getPlan(license.planId);
  const text = [
    '**VIRELLO license reminder**',
    `Your **${plan?.label || 'license'}** expires in **${daysLeft} day(s)**.`,
    `Expiry: <t:${Math.floor(license.expiresAt / 1000)}:F>`,
    'Renew via the **Renewal** panel or open a new purchase lane before access is removed.',
  ].join('\n');

  await user.send({ content: text }).catch(() => null);
}

async function sendExpiredDm(user, license) {
  const plan = getPlan(license.planId);
  const text = [
    '**VIRELLO license expired**',
    `Your **${plan?.label || 'license'}** has ended and buyer access was removed.`,
    'Open a **Renewal** or **Purchase** panel in the server to buy again.',
  ].join('\n');

  await user.send({ content: text }).catch(() => null);
}

async function removePurchaserRole(guild, userId) {
  const config = store.getGuild(guild.id);
  if (!config.roles.purchaserRoleId) return;
  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) return;
  await member.roles
    .remove(config.roles.purchaserRoleId, 'License expired')
    .catch(() => null);
}

module.exports = {
  getLicense,
  grantLicense,
  markLicenseExpired,
  licenseStatus,
  sendWelcomeDm,
  sendExpiryWarningDm,
  sendExpiredDm,
  removePurchaserRole,
};
