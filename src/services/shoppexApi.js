const { listPlans } = require('../constants/plans');

const SHOPPEX_API_BASE = (process.env.SHOPPEX_API_BASE || 'https://api.shoppex.io').replace(/\/$/, '');
const SHOPPEX_API_KEY = (process.env.SHOPPEX_API_KEY || '').trim();

const PAID_STATUSES = new Set(['COMPLETED', 'PAID', 'ACTIVE', 'FULFILLED']);

function apiConfigured() {
  return Boolean(SHOPPEX_API_KEY);
}

async function shoppexRequest(path) {
  if (!SHOPPEX_API_KEY) {
    throw new Error('SHOPPEX_API_KEY is not configured on the bot.');
  }
  const response = await fetch(`${SHOPPEX_API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${SHOPPEX_API_KEY}`,
      Accept: 'application/json',
      'User-Agent': 'VirelloBot/1.0',
    },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Shoppex API ${response.status}: ${text.slice(0, 300)}`);
  }
  return text ? JSON.parse(text) : {};
}

function normalizeDiscordId(value) {
  const text = String(value || '').trim();
  return /^\d{17,20}$/.test(text) ? text : null;
}

function collectCustomFieldValues(customFields) {
  const values = [];
  if (!customFields) return values;
  if (Array.isArray(customFields)) {
    for (const field of customFields) {
      if (!field || typeof field !== 'object') continue;
      const name = String(field.name || field.key || field.label || '').toLowerCase();
      const value = field.value ?? field.text ?? field.answer;
      if (name.includes('discord') || name.includes('user id') || name.includes('userid')) {
        values.push(value);
      }
      if (normalizeDiscordId(value)) values.push(value);
    }
    return values;
  }
  if (typeof customFields === 'object') {
    for (const [key, value] of Object.entries(customFields)) {
      const keyText = String(key).toLowerCase();
      if (keyText.includes('discord') || keyText.includes('user_id') || keyText.includes('userid')) {
        values.push(value);
      }
      if (normalizeDiscordId(value)) values.push(value);
    }
    for (const key of ['discord_user_id', 'discord_id', 'Discord user ID', 'Discord ID']) {
      if (customFields[key]) values.push(customFields[key]);
    }
  }
  return values;
}

function extractDiscordId(source) {
  if (!source || typeof source !== 'object') return null;

  const candidates = [
    source.discord_id,
    source.discordId,
    source.discord_user_id,
    source.discordUserId,
    source.customer_discord_id,
    source.customerDiscordId,
  ];

  for (const key of ['custom_fields', 'customFields']) {
    candidates.push(...collectCustomFieldValues(source[key]));
  }

  if (Array.isArray(source.items)) {
    for (const item of source.items) {
      if (!item || typeof item !== 'object') continue;
      for (const key of ['custom_fields', 'customFields']) {
        candidates.push(...collectCustomFieldValues(item[key]));
      }
      if (item.product_title) candidates.push(item.product_title);
    }
  }

  const invoice = source.invoice;
  if (invoice && typeof invoice === 'object') {
    const fromInvoice = extractDiscordId(invoice);
    if (fromInvoice) return fromInvoice;
  }

  for (const candidate of candidates) {
    const normalized = normalizeDiscordId(candidate);
    if (normalized) return normalized;
  }
  return null;
}

function planIdFromInvoice(invoice) {
  const items = Array.isArray(invoice.items) ? invoice.items : [];
  const titleCandidates = [
    invoice.product_title,
    invoice.productTitle,
    ...items.map((item) => item?.product_title || item?.productTitle).filter(Boolean),
  ];

  const plans = listPlans();
  for (const title of titleCandidates) {
    const normalized = String(title || '').trim().toLowerCase();
    const match = plans.find((plan) => {
      const planTitle = String(plan.label || plan.title || '').trim().toLowerCase();
      return planTitle === normalized || (planTitle && normalized.includes(planTitle));
    });
    if (match) return match.id;
  }

  const total = Number(invoice.total ?? invoice.total_display ?? 0);
  if (total > 0) {
    const byPrice = plans.filter((plan) => {
      const amount = Number(String(plan.price || '').replace(/[^0-9.]/g, ''));
      return Number.isFinite(amount) && Math.abs(amount - total) < 0.02;
    });
    if (byPrice.length === 1) return byPrice[0].id;
  }

  return null;
}

function invoiceIsPaid(invoice) {
  const status = String(invoice?.status || invoice?.payment_status || '').trim().toUpperCase();
  return PAID_STATUSES.has(status);
}

async function fetchInvoice(uniqid) {
  const normalized = String(uniqid || '').trim();
  if (!normalized) return null;
  try {
    const payload = await shoppexRequest(`/dev/v1/invoices/${encodeURIComponent(normalized)}`);
    if (payload?.data && typeof payload.data === 'object') return payload.data;
    return payload && typeof payload === 'object' ? payload : null;
  } catch {
    try {
      const payload = await shoppexRequest(`/dev/v1/orders/${encodeURIComponent(normalized)}`);
      if (payload?.data && typeof payload.data === 'object') return payload.data;
      return payload && typeof payload === 'object' ? payload : null;
    } catch {
      return null;
    }
  }
}

module.exports = {
  apiConfigured,
  fetchInvoice,
  extractDiscordId,
  planIdFromInvoice,
  invoiceIsPaid,
};
