/** License plan definitions — months drive expiry after approval. */
const PLANS = {
  monthly: {
    id: 'monthly',
    label: 'Monthly License',
    price: '$4.99',
    term: '/ month',
    months: 1,
    emoji: '📅',
  },
  quarterly: {
    id: 'quarterly',
    label: '3-Month License',
    price: '$12.99',
    term: '/ 3 months',
    months: 3,
    emoji: '📆',
  },
  yearly: {
    id: 'yearly',
    label: 'Yearly License',
    price: '$39.99',
    term: '/ year',
    months: 12,
    emoji: '🗓️',
  },
};

const SITE_URL = 'https://virello-secure.pages.dev/';

function getPlan(planId) {
  return PLANS[planId] || null;
}

function listPlans() {
  return Object.values(PLANS);
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
  SITE_URL,
  getPlan,
  listPlans,
  addMonthsMs,
  formatPlanLabel,
};
