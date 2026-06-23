const fs = require('fs');
const path = require('path');

const DISCORD_API_BASE = 'https://discord.com/api/v10';
const TOKEN = process.env.DISCORD_TOKEN || process.env.DISCORD_BOT_TOKEN || '';
const CHANNEL_ID = process.env.DISCORD_SYNC_CHANNEL_ID || process.env.DISCORD_BACKUP_CHANNEL_ID || '';

const DATA_DIR = path.join(__dirname, '../../data');

const FILE_MAP = {
  cache: 'virellobot-guild-config.txt',
  tickets: 'virellobot-active-tickets.txt',
  licenses: 'virellobot-licenses.txt',
  cooldowns: 'virellobot-ticket-cooldowns.txt',
  giveaways: 'virellobot-giveaways.txt',
  meta: 'virellobot-meta.txt',
};

let persistTimer = null;
let persistInFlight = false;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function localPath(filename) {
  return path.join(DATA_DIR, filename);
}

function readLocalJson(filename, fallback) {
  ensureDataDir();
  const file = localPath(filename);
  if (!fs.existsSync(file)) return structuredClone(fallback);
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return structuredClone(fallback);
  }
}

function writeLocalJson(filename, data) {
  ensureDataDir();
  fs.writeFileSync(localPath(filename), JSON.stringify(data, null, 2), 'utf8');
}

function isConfigured() {
  return Boolean(TOKEN && CHANNEL_ID);
}

async function discordRequest(method, apiPath, { body, headers = {} } = {}) {
  const response = await fetch(`${DISCORD_API_BASE}${apiPath}`, {
    method,
    headers: {
      Authorization: `Bot ${TOKEN}`,
      'User-Agent': 'VirelloBotDiscordSync/1.0',
      ...headers,
    },
    body,
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Discord API ${response.status}: ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

async function listMessages(limit = 100) {
  return discordRequest('GET', `/channels/${CHANNEL_ID}/messages?limit=${limit}`);
}

function attachmentFromMessage(message, filename) {
  for (const attachment of message.attachments || []) {
    if (attachment.filename === filename) return attachment;
  }
  return null;
}

async function findLatestAttachment(filename) {
  const messages = await listMessages();
  let latest = null;
  for (const message of messages) {
    const attachment = attachmentFromMessage(message, filename);
    if (!attachment) continue;
    const createdAt = Date.parse(message.timestamp);
    if (!latest || createdAt > latest.createdAt) {
      latest = { attachment, createdAt };
    }
  }
  return latest?.attachment || null;
}

async function downloadText(url) {
  const response = await fetch(url, { headers: { 'User-Agent': 'VirelloBotDiscordSync/1.0' } });
  if (!response.ok) {
    throw new Error(`Download failed (${response.status})`);
  }
  return response.text();
}

async function uploadText(filename, text, label) {
  const form = new FormData();
  form.append(
    'payload_json',
    JSON.stringify({
      content: `Virello Bot data sync: ${label} (${new Date().toISOString()})`,
    })
  );
  form.append('files[0]', new Blob([text], { type: 'text/plain' }), filename);
  return discordRequest('POST', `/channels/${CHANNEL_ID}/messages`, { body: form });
}

function readLocalAll() {
  return {
    cache: readLocalJson(FILE_MAP.cache, {}),
    tickets: readLocalJson(FILE_MAP.tickets, {}),
    licenses: readLocalJson(FILE_MAP.licenses, {}),
    cooldowns: readLocalJson(FILE_MAP.cooldowns, {}),
    giveaways: readLocalJson(FILE_MAP.giveaways, {}),
    meta: readLocalJson(FILE_MAP.meta, {}),
  };
}

function hasLocalData(data) {
  return Boolean(
    Object.keys(data.cache || {}).length
      || Object.keys(data.tickets || {}).length
      || Object.keys(data.licenses || {}).length
      || Object.keys(data.cooldowns || {}).length
      || Object.keys(data.giveaways || {}).length
  );
}

async function loadKeyFromDiscord(key) {
  const filename = FILE_MAP[key];
  const attachment = await findLatestAttachment(filename);
  if (!attachment?.url) return null;
  const text = await downloadText(attachment.url);
  return JSON.parse(text);
}

async function loadAll() {
  const local = readLocalAll();
  if (!isConfigured()) {
    return local;
  }

  const merged = { ...local };
  let loadedFromDiscord = false;

  for (const key of ['cache', 'tickets', 'licenses', 'cooldowns', 'giveaways', 'meta']) {
    try {
      const remote = await loadKeyFromDiscord(key);
      if (remote && (key === 'meta' || Object.keys(remote).length)) {
        merged[key] = remote;
        writeLocalJson(FILE_MAP[key], remote);
        loadedFromDiscord = true;
      }
    } catch (error) {
      console.warn(`Discord sync load failed for ${key}:`, error.message || error);
    }
  }

  if (!loadedFromDiscord && hasLocalData(local)) {
    try {
      await persistAll(local);
      console.log('Discord sync: uploaded local data to channel (first-time seed).');
    } catch (error) {
      console.warn('Discord sync seed upload failed:', error.message || error);
    }
  }

  return merged;
}

async function persistAll(snapshot) {
  if (!snapshot) return;
  for (const [key, filename] of Object.entries(FILE_MAP)) {
    const payload = snapshot[key] ?? (key === 'meta' ? {} : {});
    writeLocalJson(filename, payload);
    if (isConfigured()) {
      await uploadText(filename, JSON.stringify(payload, null, 2), key);
    }
  }
}

function schedulePersist(snapshotProvider) {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(async () => {
    if (persistInFlight) return;
    persistInFlight = true;
    try {
      const snapshot = typeof snapshotProvider === 'function' ? snapshotProvider() : snapshotProvider;
      await persistAll(snapshot);
    } catch (error) {
      console.error('Discord sync persist failed:', error.message || error);
    } finally {
      persistInFlight = false;
    }
  }, 2500);
}

function exportSnapshot(store) {
  return {
    cache: store._cache,
    tickets: store._tickets,
    licenses: store._licenses,
    cooldowns: store._cooldowns,
    giveaways: store._giveaways,
    meta: {
      last_sync_at: new Date().toISOString(),
    },
  };
}

module.exports = {
  isConfigured,
  loadAll,
  persistAll,
  schedulePersist,
  exportSnapshot,
  FILE_MAP,
};
