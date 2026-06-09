const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const store = require('../config/store');
const backup = require('../services/backupService');
const auth = require('./auth');

const PANEL_HTML = fs.readFileSync(path.join(__dirname, 'panel.html'), 'utf8');
const GUILD_ID = process.env.GUILD_ID || process.env.DISCORD_GUILD_ID || '';

function sendJson(res, status, payload, extraHeaders = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json', ...extraHeaders });
  res.end(JSON.stringify(payload));
}

function sendHtml(res, status, html, extraHeaders = {}) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', ...extraHeaders });
  res.end(html);
}

function maskConfig(config) {
  const clone = structuredClone(config);
  if (clone.payments) {
    for (const key of Object.keys(clone.payments)) {
      if (typeof clone.payments[key] === 'string' && clone.payments[key].length > 4) {
        clone.payments[key] = '••••';
      }
    }
  }
  return clone;
}

async function handleAdminRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname.replace(/\/+$/, '') || '/admin';

  if (pathname === '/admin/auth/login') {
    if (!auth.oauthConfigured()) {
      sendJson(res, 503, { detail: 'Admin OAuth is not configured.' });
      return;
    }
    const state = crypto.randomBytes(16).toString('hex');
    res.writeHead(302, {
      Location: auth.buildLoginUrl(state),
      'Set-Cookie': `virello_admin_state=${state}; Path=/admin; HttpOnly; SameSite=Lax; Max-Age=600`,
    });
    res.end();
    return;
  }

  if (pathname === '/admin/auth/callback') {
    const code = url.searchParams.get('code');
    if (!code) {
      sendHtml(res, 403, '<h1>Missing OAuth code</h1>');
      return;
    }
    try {
      const tokenData = await auth.exchangeCode(code);
      const user = await auth.fetchDiscordUser(tokenData.access_token);
      if (!auth.isSuperAdmin(user.id)) {
        sendHtml(
          res,
          403,
          '<h1>Access denied</h1><p>This panel is restricted to the bot owner account.</p><p><a href="/admin">Back</a></p>'
        );
        return;
      }
      res.writeHead(302, {
        Location: '/admin',
        'Set-Cookie': auth.makeSessionCookie(user),
      });
      res.end();
      return;
    } catch (error) {
      sendHtml(res, 500, `<h1>Login failed</h1><p>${error.message}</p>`);
      return;
    }
  }

  if (pathname === '/admin/auth/logout') {
    res.writeHead(302, {
      Location: '/admin',
      'Set-Cookie': auth.clearSessionCookie(),
    });
    res.end();
    return;
  }

  const session = auth.sessionFromRequest(req);

  if (pathname === '/admin/api/me') {
    if (!session) {
      sendJson(res, 401, { detail: 'Not signed in' });
      return;
    }
    sendJson(res, 200, { userId: session.userId, username: session.username });
    return;
  }

  if (pathname.startsWith('/admin/api/')) {
    if (!session) {
      sendJson(res, 401, { detail: 'Not signed in' });
      return;
    }

    if (pathname === '/admin/api/health') {
      const payload = await backup.getHealthStatus();
      sendJson(res, payload.status === 'ok' ? 200 : 503, payload);
      return;
    }

    if (pathname === '/admin/api/overview') {
      const guildId = GUILD_ID;
      const tickets = guildId ? store.listTicketsForGuild(guildId) : [];
      const licenses = guildId ? store.listLicensesForGuild(guildId) : [];
      const openTickets = tickets.filter((t) => t.stage !== 'closed');
      const activeLicenses = licenses.filter((l) => !l.expiresAt || l.expiresAt > Date.now());
      sendJson(res, 200, {
        guildId: guildId || null,
        ticketCount: tickets.length,
        openTicketCount: openTickets.length,
        licenseCount: licenses.length,
        activeLicenseCount: activeLicenses.length,
        storage: process.env.DATABASE_URL ? 'postgresql' : 'json',
      });
      return;
    }

    if (pathname === '/admin/api/tickets') {
      const guildId = GUILD_ID;
      const tickets = guildId ? store.listTicketsForGuild(guildId) : [];
      sendJson(res, 200, tickets.slice(0, 200));
      return;
    }

    if (pathname === '/admin/api/licenses') {
      const guildId = GUILD_ID;
      const licenses = guildId ? store.listLicensesForGuild(guildId) : [];
      sendJson(res, 200, licenses.slice(0, 200));
      return;
    }

    if (pathname === '/admin/api/config' && req.method === 'GET') {
      const guildId = GUILD_ID;
      if (!guildId) {
        sendJson(res, 200, {});
        return;
      }
      sendJson(res, 200, maskConfig(store.getGuild(guildId)));
      return;
    }

    if (pathname === '/admin/api/backup/trigger' && req.method === 'POST') {
      try {
        await backup.createAndUploadBackup();
        sendJson(res, 200, { ok: true, message: 'Backup uploaded to Discord.' });
      } catch (error) {
        sendJson(res, 500, { detail: error.message });
      }
      return;
    }

    sendJson(res, 404, { detail: 'Not found' });
    return;
  }

  if (pathname === '/admin' || pathname === '/admin/') {
    sendHtml(res, 200, PANEL_HTML);
    return;
  }

  sendJson(res, 404, { detail: 'Not found' });
}

module.exports = { handleAdminRequest };
