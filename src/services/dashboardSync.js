const { listPlans } = require('../constants/plans');

const DEFAULT_API = 'https://virello-secure.onrender.com';
const SYNC_INTERVAL_MS = Math.max(5, Number(process.env.PLANS_SYNC_INTERVAL_MINUTES || 60)) * 60 * 1000;

async function fetchJson(url) {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function syncDashboardCatalog() {
  const base = (process.env.VIRELLO_API_URL || DEFAULT_API).replace(/\/$/, '');
  const { setPlansFromApi } = require('../constants/plans');

  try {
    const pricing = await fetchJson(`${base}/site/pricing`);
    setPlansFromApi(pricing.personal || [], pricing.enterprise || []);
    return { ok: true, plans: listPlans().length };
  } catch (error) {
    console.warn('[dashboardSync] pricing sync failed:', error.message);
    return { ok: false, error: error.message };
  }
}

async function fetchChangelog() {
  const base = (process.env.VIRELLO_API_URL || DEFAULT_API).replace(/\/$/, '');
  try {
    return await fetchJson(`${base}/site/changelog`);
  } catch {
    return [];
  }
}

function startPricingSyncLoop() {
  void syncDashboardCatalog();
  setInterval(() => {
    void syncDashboardCatalog();
  }, SYNC_INTERVAL_MS);
}

module.exports = {
  syncDashboardCatalog,
  fetchChangelog,
  startPricingSyncLoop,
};
