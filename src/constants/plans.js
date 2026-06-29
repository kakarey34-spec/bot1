/** License plan definitions — synced with Virello dashboard pricing API. */

const FALLBACK_PLANS = {
  monthly: {
    id: 'monthly',
    label: 'Monthly Personal',
    price: '$8.99',
    term: '/ month',
    months: 1,
    slots: 1,
    emoji: '📅',
    tier: 'personal',
  },
  semiannual: {
    id: 'semiannual',
    label: '6-Month Personal',
    price: '$39.99',
    term: '/ 6 months',
    months: 6,
    slots: 1,
    emoji: '📆',
    tier: 'personal',
  },
  yearly: {
    id: 'yearly',
    label: 'Yearly Personal',
    price: '$69.99',
    term: '/ year',
    months: 12,
    slots: 1,
    emoji: '🗓️',
    tier: 'personal',
  },
  duo: {
    id: 'duo',
    label: 'Duo Team',
    price: '$17.99',
    term: '/ month',
    months: 1,
    slots: 2,
    emoji: '👥',
    tier: 'enterprise',
  },
  enterprise_10: {
    id: 'enterprise_10',
    label: 'Enterprise (10 seats)',
    price: '$64.99',
    term: '/ 6 months',
    months: 6,
    slots: 10,
    emoji: '🏢',
    tier: 'enterprise',
  },
  enterprise_20: {
    id: 'enterprise_20',
    label: 'Enterprise+ (20 seats)',
    price: '$89.99',
    term: '/ 6 months',
    months: 6,
    slots: 20,
    emoji: '🏛️',
    tier: 'enterprise',
  },
};

let PLANS = { ...FALLBACK_PLANS };

const SITE_URL = process.env.FRONTEND_URL || 'https://virello-secure.pages.dev/';

function setPlansFromApi(personal = [], enterprise = []) {
  const next = {};
  for (const plan of [...personal, ...enterprise]) {
    if (!plan?.id) continue;
    next[plan.id] = {
      id: plan.id,
      label: plan.title || plan.label || plan.id,
      price: plan.price || '$0',
      term: plan.period || plan.term || '',
      months: plan.months || 1,
      slots: plan.slots || 1,
      emoji: plan.emoji || '⭐',
      tier: plan.tier || 'personal',
      blurb: plan.blurb || '',
      features: plan.features || [],
    };
  }
  if (Object.keys(next).length) {
    PLANS = next;
  }
}

function getPlan(planId) {
  return PLANS[planId] || null;
}

function listPlans() {
  return Object.values(PLANS);
}

function listPersonalPlans() {
  return listPlans().filter((plan) => plan.tier !== 'enterprise');
}

function listEnterprisePlans() {
  return listPlans().filter((plan) => plan.tier === 'enterprise');
}

function addMonthsMs(timestampMs, months) {
  const d = new Date(timestampMs);
  d.setMonth(d.getMonth() + months);
  return d.getTime();
}

function formatPlanLabel(planId) {
  const plan = getPlan(planId);
  if (!plan) return planId || 'Unknown';
  return `${plan.label} (${plan.price}${plan.term})`;
}

module.exports = {
  PLANS,
  FALLBACK_PLANS,
  SITE_URL,
  getPlan,
  listPlans,
  listPersonalPlans,
  listEnterprisePlans,
  setPlansFromApi,
  addMonthsMs,
  formatPlanLabel,
};
