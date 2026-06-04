const store = require('../config/store');
const { getPlan } = require('../constants/plans');

const PROMO_TYPES = {
  extra_days: 'extra_days',
  discount_percent: 'discount_percent',
};

function normalizeCode(code) {
  return String(code || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '');
}

function getPromoMap(guildId) {
  return store.getGuild(guildId).promos || {};
}

function getPromo(guildId, code) {
  const key = normalizeCode(code);
  if (!key) return null;
  return getPromoMap(guildId)[key] || null;
}

function savePromo(guildId, promo) {
  const config = store.getGuild(guildId);
  const promos = { ...(config.promos || {}) };
  promos[promo.code] = promo;
  store.setGuild(guildId, { promos });
  return promo;
}

function deletePromo(guildId, code) {
  const key = normalizeCode(code);
  const config = store.getGuild(guildId);
  const promos = { ...(config.promos || {}) };
  if (!promos[key]) return false;
  delete promos[key];
  store.setGuild(guildId, { promos });
  return true;
}

function listPromos(guildId) {
  return Object.values(getPromoMap(guildId)).sort((a, b) => b.createdAt - a.createdAt);
}

function validatePromo(guildId, code) {
  const key = normalizeCode(code);
  if (!key) return { error: 'Enter a valid promo code.' };

  const promo = getPromo(guildId, key);
  if (!promo) return { error: 'That promo code does not exist.' };
  if (promo.expiresAt && Date.now() > promo.expiresAt) {
    return { error: 'This promo code has expired.' };
  }
  if (promo.maxUses != null && promo.uses >= promo.maxUses) {
    return { error: 'This promo code has reached its use limit.' };
  }

  return { ok: true, promo };
}

function consumePromo(guildId, code) {
  const key = normalizeCode(code);
  const promo = getPromo(guildId, key);
  if (!promo) return;
  promo.uses = (promo.uses || 0) + 1;
  savePromo(guildId, promo);
}

function formatPromoLimits(promo) {
  const uses =
    promo.maxUses != null ? `${promo.uses || 0}/${promo.maxUses} uses` : `${promo.uses || 0}/∞ uses`;
  const valid =
    promo.expiresAt != null
      ? `expires <t:${Math.floor(promo.expiresAt / 1000)}:F>`
      : 'no expiry';
  const days =
    promo.validDays != null ? `active ${promo.validDays} day(s) from creation` : null;
  return [uses, days, valid].filter(Boolean).join(' · ');
}

function promoLabel(promo) {
  if (promo.type === PROMO_TYPES.extra_days) {
    return `+${promo.value} bonus day(s)`;
  }
  if (promo.type === PROMO_TYPES.discount_percent) {
    return `${promo.value}% off`;
  }
  return promo.code;
}

function applyPromoToLicense(license, promo) {
  if (!promo) return license;
  license.promoCode = promo.code;
  if (promo.type === PROMO_TYPES.extra_days) {
    const days = Number(promo.value) || 0;
    license.expiresAt += days * 24 * 60 * 60 * 1000;
    license.promoBonusDays = days;
  }
  if (promo.type === PROMO_TYPES.discount_percent) {
    license.promoDiscountPercent = promo.value;
  }
  return license;
}

function formatPlanLineWithPromo(plan, promo) {
  const base = `**${plan.label}** (${plan.price}${plan.term})`;
  if (!promo) return base;
  if (promo.type === PROMO_TYPES.discount_percent) {
    return `${base}\n🎟️ Promo **${promo.code}**: **${promo.value}% off** — include the code in your payment note.`;
  }
  if (promo.type === PROMO_TYPES.extra_days) {
    return `${base}\n🎟️ Promo **${promo.code}**: **+${promo.value} extra day(s)** on your license after approval.`;
  }
  return base;
}

function createPromoRecord(guildId, data) {
  const code = normalizeCode(data.code);
  if (!code || code.length < 3) return { error: 'Code must be at least 3 characters (letters/numbers).' };

  if (getPromo(guildId, code)) return { error: 'That promo code already exists.' };

  const type = data.type;
  if (!PROMO_TYPES[type]) return { error: 'Invalid promo type.' };

  const value = Number(data.value);
  if (!Number.isFinite(value) || value <= 0) return { error: 'Value must be a positive number.' };

  if (type === PROMO_TYPES.discount_percent && (value < 1 || value > 90)) {
    return { error: 'Discount must be between 1 and 90 percent.' };
  }
  if (type === PROMO_TYPES.extra_days && (value < 1 || value > 365)) {
    return { error: 'Extra days must be between 1 and 365.' };
  }

  let expiresAt = data.expiresAt ?? null;
  if (data.validDays != null) {
    expiresAt = Date.now() + data.validDays * 24 * 60 * 60 * 1000;
  }

  const promo = {
    code,
    type,
    value,
    maxUses: data.maxUses ?? null,
    validDays: data.validDays ?? null,
    uses: 0,
    expiresAt,
    createdAt: Date.now(),
    createdBy: data.createdBy,
    note: data.note || null,
  };

  savePromo(guildId, promo);
  return { ok: true, promo };
}

function applyPromoToTicket(ticket, promo) {
  ticket.promoCode = promo.code;
  ticket.promoType = promo.type;
  ticket.promoValue = promo.value;
  return ticket;
}

function parsePlanAmount(plan) {
  if (!plan?.price) return null;
  const match = String(plan.price).match(/(\d+(?:\.\d{1,2})?)/);
  if (!match) return null;
  const amount = parseFloat(match[1]);
  return Number.isFinite(amount) ? amount : null;
}

function formatUsd(amount) {
  if (amount == null || !Number.isFinite(amount)) return null;
  return `$${amount.toFixed(2)}`;
}

/** @returns {{ original, amountDue, discountPercent?, formattedOriginal, formattedDue, hasNumericPrice }} */
function computeTicketPricing(plan, promo) {
  const original = parsePlanAmount(plan);
  const formattedOriginal = original != null ? formatUsd(original) : plan?.price || '—';

  if (original == null) {
    return {
      original: null,
      amountDue: null,
      formattedOriginal,
      formattedDue: formattedOriginal,
      hasNumericPrice: false,
    };
  }

  if (!promo || promo.type !== PROMO_TYPES.discount_percent) {
    return {
      original,
      amountDue: original,
      formattedOriginal,
      formattedDue: formatUsd(original),
      hasNumericPrice: true,
    };
  }

  const discountPercent = Number(promo.value) || 0;
  const amountDue = Math.round(original * (1 - discountPercent / 100) * 100) / 100;

  return {
    original,
    amountDue,
    discountPercent,
    formattedOriginal,
    formattedDue: formatUsd(amountDue),
    hasNumericPrice: true,
  };
}

function syncTicketPricing(ticket, plan, promo) {
  const pricing = computeTicketPricing(plan, promo);
  ticket.originalAmount = pricing.original;
  ticket.amountDue = pricing.amountDue;
  return pricing;
}

function buildAmountDueLines(plan, promo, pricing) {
  const lines = [];

  if (!pricing.hasNumericPrice) {
    lines.push(`**Listed price:** ${plan.price}${plan.term}`);
    if (promo?.type === PROMO_TYPES.discount_percent) {
      lines.push(`🎟️ Promo **${promo.code}** (${promo.value}% off) — staff will confirm the exact amount.`);
    }
    return lines.join('\n');
  }

  if (promo?.type === PROMO_TYPES.discount_percent && pricing.discountPercent) {
    lines.push(`**Original price:** ${pricing.formattedOriginal}${plan.term}`);
    lines.push(`**Promo \`${promo.code}\`:** ${promo.value}% off`);
    lines.push(`**You need to send:** ${pricing.formattedDue}`);
  } else if (promo?.type === PROMO_TYPES.extra_days) {
    lines.push(`**Amount to send:** ${pricing.formattedDue}${plan.term}`);
    lines.push(`🎟️ Promo **${promo.code}:** +${promo.value} bonus day(s) after approval.`);
  } else {
    lines.push(`**You need to send:** ${pricing.formattedDue}${plan.term}`);
  }

  return lines.join('\n');
}

function resolveTicketPromo(guildId, ticket) {
  if (!ticket?.promoCode) return { promo: null };
  const validated = validatePromo(guildId, ticket.promoCode);
  if (validated.error) return { error: validated.error };
  return { promo: validated.promo };
}

module.exports = {
  PROMO_TYPES,
  normalizeCode,
  getPromo,
  listPromos,
  deletePromo,
  validatePromo,
  consumePromo,
  createPromoRecord,
  applyPromoToLicense,
  applyPromoToTicket,
  formatPlanLineWithPromo,
  promoLabel,
  formatPromoLimits,
  parsePlanAmount,
  formatUsd,
  computeTicketPricing,
  syncTicketPricing,
  buildAmountDueLines,
  resolveTicketPromo,
};
