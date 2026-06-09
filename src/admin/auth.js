const crypto = require('crypto');
const { URL } = require('url');

const SUPER_ADMIN_IDS = new Set(
  (process.env.BOT_SUPER_ADMIN_IDS || '1262056594993315943')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
);

const SESSION_SECRET =
  process.env.ADMIN_SESSION_SECRET || process.env.DISCORD_TOKEN || 'local-admin-secret-change-me';
const CLIENT_ID = process.env.CLIENT_ID || '';
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || '';
const REDIRECT_URI = process.env.ADMIN_CALLBACK_URL || '';
const DISCORD_API = 'https://discord.com/api/v10';
const SESSION_MS = Number(process.env.ADMIN_SESSION_HOURS || 8) * 60 * 60 * 1000;

function isSuperAdmin(userId) {
  return SUPER_ADMIN_IDS.has(String(userId));
}

function adminPanelUrl() {
  const explicit = (process.env.ADMIN_PUBLIC_URL || '').trim().replace(/\/$/, '');
  if (explicit) return `${explicit}/admin`;
  const callback = (process.env.ADMIN_CALLBACK_URL || '').trim();
  if (callback) {
    const base = callback.replace(/\/admin\/auth\/callback\/?$/i, '').replace(/\/$/, '');
    if (base) return `${base}/admin`;
  }
  return null;
}

function oauthConfigured() {
  return Boolean(CLIENT_ID && CLIENT_SECRET && REDIRECT_URI);
}

function signSession(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verifySession(token) {
  if (!token) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload?.userId || payload.exp < Date.now()) return null;
    if (!isSuperAdmin(payload.userId)) return null;
    return payload;
  } catch {
    return null;
  }
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    out[key] = decodeURIComponent(value);
  }
  return out;
}

function sessionFromRequest(req) {
  const cookies = parseCookies(req.headers.cookie || '');
  return verifySession(cookies.virello_admin);
}

function buildLoginUrl(state) {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'identify',
    state,
  });
  return `https://discord.com/oauth2/authorize?${params}`;
}

async function exchangeCode(code) {
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
  });
  const response = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Discord token exchange failed: ${response.status}`);
  }
  return JSON.parse(text);
}

async function fetchDiscordUser(accessToken) {
  const response = await fetch(`${DISCORD_API}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Discord profile fetch failed: ${response.status}`);
  }
  return JSON.parse(text);
}

function makeSessionCookie(user) {
  const token = signSession({
    userId: user.id,
    username: user.username,
    exp: Date.now() + SESSION_MS,
  });
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `virello_admin=${encodeURIComponent(token)}; Path=/admin; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(SESSION_MS / 1000)}${secure}`;
}

function clearSessionCookie() {
  return 'virello_admin=; Path=/admin; HttpOnly; SameSite=Lax; Max-Age=0';
}

module.exports = {
  isSuperAdmin,
  adminPanelUrl,
  oauthConfigured,
  sessionFromRequest,
  buildLoginUrl,
  exchangeCode,
  fetchDiscordUser,
  makeSessionCookie,
  clearSessionCookie,
  signSession,
};
