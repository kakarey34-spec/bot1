const crypto = require('crypto');
const shoppexApi = require('../services/shoppexApi');
const shoppexFulfillment = require('../services/shoppexFulfillment');

function fulfillmentSecret() {
  return (process.env.BOT_FULFILLMENT_SECRET || process.env.SHOPPEX_FULFILLMENT_SECRET || '').trim();
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function verifySecret(req, rawBody) {
  const secret = fulfillmentSecret();
  if (!secret) return false;

  const header = String(req.headers['x-virello-fulfillment-secret'] || '').trim();
  if (header && header.length === secret.length && crypto.timingSafeEqual(Buffer.from(header), Buffer.from(secret))) {
    return true;
  }

  const auth = String(req.headers.authorization || '').trim();
  if (auth.toLowerCase().startsWith('bearer ')) {
    const token = auth.slice(7).trim();
    if (token.length === secret.length && crypto.timingSafeEqual(Buffer.from(token), Buffer.from(secret))) {
      return true;
    }
  }

  const signature = String(req.headers['x-virello-signature'] || '').trim();
  if (signature) {
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    if (signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      return true;
    }
  }

  return false;
}

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

async function handleShoppexFulfillRequest(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { detail: 'Method not allowed' });
    return;
  }

  if (!fulfillmentSecret()) {
    sendJson(res, 503, { detail: 'Bot fulfillment webhook not configured' });
    return;
  }

  let rawBody;
  try {
    rawBody = await readBody(req);
  } catch {
    sendJson(res, 400, { detail: 'Failed to read body' });
    return;
  }

  if (!verifySecret(req, rawBody)) {
    sendJson(res, 401, { detail: 'Invalid fulfillment secret' });
    return;
  }

  let payload;
  try {
    payload = JSON.parse(rawBody.toString('utf8') || '{}');
  } catch {
    sendJson(res, 400, { detail: 'Invalid JSON' });
    return;
  }

  const action = String(payload.action || 'fulfill').trim().toLowerCase();
  const invoiceId = String(payload.invoice_id || payload.invoiceId || '').trim() || null;
  const discordId = String(payload.discord_id || payload.discordId || '').trim() || null;
  const planId = String(payload.plan_id || payload.planId || '').trim() || null;

  if (action === 'revoke') {
    const result = await shoppexFulfillment.revokeShoppexPurchase({
      discordId,
      reason: String(payload.reason || 'Shoppex subscription ended'),
    });
    if (!result.ok) {
      const status = result.reason === 'guild_not_found' ? 503 : 400;
      sendJson(res, status, result);
      return;
    }
    sendJson(res, 200, result);
    return;
  }

  let result;
  if (invoiceId) {
    result = await shoppexFulfillment.fulfillFromInvoice(invoiceId, {
      discordId,
      requirePaid: true,
    });
  } else if (discordId && planId) {
    result = await shoppexFulfillment.fulfillShoppexPurchase({
      discordId,
      planId,
      invoiceId: null,
    });
  } else {
    sendJson(res, 400, { detail: 'invoice_id or discord_id+plan_id required' });
    return;
  }

  if (!result.ok) {
    const retryable = new Set(['invoice_not_paid', 'invoice_not_found', 'missing_discord_id', 'missing_plan_id']);
    const status = result.reason === 'user_not_in_guild' ? 422 : retryable.has(result.reason) ? 409 : 400;
    sendJson(res, status, result);
    return;
  }

  sendJson(res, 200, result);
}

module.exports = { handleShoppexFulfillRequest };
