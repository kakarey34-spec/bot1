const DEFAULT_API = 'https://virello-secure.onrender.com';

function syncConfigured() {
  const base = (process.env.VIRELLO_API_URL || DEFAULT_API).replace(/\/$/, '');
  const secret = (process.env.BOT_FULFILLMENT_SECRET || process.env.SHOPPEX_FULFILLMENT_SECRET || '').trim();
  return Boolean(base && secret);
}

async function postLicenseSync(body) {
  if (!syncConfigured()) {
    return { ok: false, reason: 'not_configured' };
  }

  const base = (process.env.VIRELLO_API_URL || DEFAULT_API).replace(/\/$/, '');
  const secret = (process.env.BOT_FULFILLMENT_SECRET || process.env.SHOPPEX_FULFILLMENT_SECRET || '').trim();

  try {
    const response = await fetch(`${base}/webhooks/bot-license`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Virello-Fulfillment-Secret': secret,
        'User-Agent': 'VirelloBot/1.0',
      },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    let payload = {};
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      payload = { detail: text.slice(0, 300) };
    }
    if (!response.ok) {
      return { ok: false, reason: `http_${response.status}`, detail: payload };
    }
    return { ok: true, payload };
  } catch (error) {
    return { ok: false, reason: 'request_failed', detail: String(error.message || error) };
  }
}

async function syncLicenseGrant({ discordId, planId, invoiceId = null, expiresAt = null }) {
  const result = await postLicenseSync({
    action: 'grant',
    discord_id: discordId,
    plan_id: planId,
    invoice_id: invoiceId,
    expires_at_ms: expiresAt,
  });
  if (!result.ok) {
    console.warn('[licenseSync] grant failed:', result.reason, result.detail || '');
  }
  return result;
}

async function syncLicenseRevoke({ discordId, invoiceId = null, reason = 'License ended' }) {
  const result = await postLicenseSync({
    action: 'revoke',
    discord_id: discordId,
    invoice_id: invoiceId,
    reason,
  });
  if (!result.ok) {
    console.warn('[licenseSync] revoke failed:', result.reason, result.detail || '');
  }
  return result;
}

module.exports = {
  syncConfigured,
  syncLicenseGrant,
  syncLicenseRevoke,
};
