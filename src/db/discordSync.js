const fs = require('fs');
const path = require('path');

const DISCORD_API_BASE = 'https://discord.com/api/v10';
const TOKEN = process.env.DISCORD_TOKEN || process.env.DISCORD_BOT_TOKEN || '';
const CHANNEL_ID = process.env.DISCORD_SYNC_CHANNEL_ID || process.env.DISCORD_BACKUP_CHANNEL_ID || '';

const DATA_DIR = path.join(__dirname, '../../data');
const SNAPSHOT_FILENAME = 'virellobot-backup.txt';
const SNAPSHOT_VERSION = 1;

const LEGACY_FILE_MAP = {
  cache: 'virellobot-guild-config.txt',
  tickets: 'virellobot-active-tickets.txt',
  licenses: 'virellobot-licenses.txt',
  cooldowns: 'virellobot-ticket-cooldowns.txt',
  giveaways: 'virellobot-giveaways.txt',
  meta: 'virellobot-meta.txt',
};

const SNAPSHOT_KEYS = ['cache', 'tickets', 'licenses', 'cooldowns', 'giveaways'];

let persistTimer = null;
let persistInFlight = false;
let lastSyncAt = null;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function localSnapshotPath() {
  return path.join(DATA_DIR, SNAPSHOT_FILENAME);
}

function emptySnapshot() {
  return {
    cache: {},
    tickets: {},
    licenses: {},
    cooldowns: {},
    giveaways: {},
    meta: {},
  };
}

function readLocalJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return structuredClone(fallback);
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return structuredClone(fallback);
  }
}

function packSnapshot(snapshot) {
  const packed = {
    version: SNAPSHOT_VERSION,
    exported_at: new Date().toISOString(),
    cache: snapshot.cache ?? {},
    tickets: snapshot.tickets ?? {},
    licenses: snapshot.licenses ?? {},
    cooldowns: snapshot.cooldowns ?? {},
    giveaways: snapshot.giveaways ?? {},
    meta: {
      ...(snapshot.meta ?? {}),
      last_sync_at: new Date().toISOString(),
    },
  };
  return packed;
}

function unpackSnapshot(data) {
  if (!data || typeof data !== 'object') return emptySnapshot();
  return {
    cache: data.cache ?? {},
    tickets: data.tickets ?? {},
    licenses: data.licenses ?? {},
    cooldowns: data.cooldowns ?? {},
    giveaways: data.giveaways ?? {},
    meta: data.meta ?? {},
  };
}

function readLocalSnapshot() {
  const raw = readLocalJson(localSnapshotPath(), null);
  if (!raw) return null;
  return unpackSnapshot(raw);
}

function readLegacyLocalAll() {
  return {
    cache: readLocalJson(path.join(DATA_DIR, 'guild-config.json'), {}),
    tickets: readLocalJson(path.join(DATA_DIR, 'active-tickets.json'), {}),
    licenses: readLocalJson(path.join(DATA_DIR, 'licenses.json'), {}),
    cooldowns: readLocalJson(path.join(DATA_DIR, 'ticket-cooldowns.json'), {}),
    giveaways: readLocalJson(path.join(DATA_DIR, 'giveaways.json'), {}),
    meta: {},
  };
}

function writeLocalSnapshot(packed) {
  ensureDataDir();
  fs.writeFileSync(localSnapshotPath(), JSON.stringify(packed, null, 2), 'utf8');
}

function hasLocalData(data) {
  return SNAPSHOT_KEYS.some((key) => Object.keys(data[key] || {}).length > 0);
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

async function findLatestAttachment(filename) {
  const messages = await listMessages();
  let latest = null;
  for (const message of messages) {
    for (const attachment of message.attachments || []) {
      if (attachment.filename !== filename) continue;
      const createdAt = Date.parse(message.timestamp);
      if (!latest || createdAt > latest.createdAt) {
        latest = { attachment, createdAt };
      }
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

async function uploadSnapshot(packed) {
  const text = JSON.stringify(packed, null, 2);
  const form = new FormData();
  form.append(
    'payload_json',
    JSON.stringify({
      content: `Virello Bot backup (${packed.exported_at})`,
    })
  );
  form.append('files[0]', new Blob([text], { type: 'text/plain' }), SNAPSHOT_FILENAME);
  await discordRequest('POST', `/channels/${CHANNEL_ID}/messages`, { body: form });
  lastSyncAt = packed.meta?.last_sync_at || packed.exported_at;
}

async function loadSnapshotFromDiscord() {
  const attachment = await findLatestAttachment(SNAPSHOT_FILENAME);
  if (!attachment?.url) return null;
  const text = await downloadText(attachment.url);
  return unpackSnapshot(JSON.parse(text));
}

async function loadLegacyFromDiscord() {
  const merged = emptySnapshot();
  let loaded = false;
  for (const key of [...SNAPSHOT_KEYS, 'meta']) {
    try {
      const filename = LEGACY_FILE_MAP[key];
      const attachment = await findLatestAttachment(filename);
      if (!attachment?.url) continue;
      const text = await downloadText(attachment.url);
      const remote = JSON.parse(text);
      if (key === 'meta' || Object.keys(remote).length) {
        merged[key] = remote;
        loaded = true;
      }
    } catch (error) {
      console.warn(`Discord legacy sync load failed for ${key}:`, error.message || error);
    }
  }
  return loaded ? merged : null;
}

async function loadAll() {
  const local = readLocalSnapshot() || readLegacyLocalAll();
  if (!isConfigured()) {
    return local;
  }

  try {
    const remote = await loadSnapshotFromDiscord();
    if (remote && hasLocalData(remote)) {
      writeLocalSnapshot(packSnapshot(remote));
      console.log('Discord sync: loaded unified backup file.');
      return remote;
    }
  } catch (error) {
    console.warn('Discord unified backup load failed:', error.message || error);
  }

  try {
    const legacy = await loadLegacyFromDiscord();
    if (legacy && hasLocalData(legacy)) {
      await persistAll(legacy);
      console.log('Discord sync: migrated legacy multi-file backup to unified file.');
      return legacy;
    }
  } catch (error) {
    console.warn('Discord legacy backup load failed:', error.message || error);
  }

  if (hasLocalData(local)) {
    try {
      await persistAll(local);
      console.log('Discord sync: uploaded local data to channel (first-time seed).');
    } catch (error) {
      console.warn('Discord sync seed upload failed:', error.message || error);
    }
  }

  return local;
}

async function persistAll(snapshot) {
  if (!snapshot) return;
  const packed = packSnapshot(snapshot);
  writeLocalSnapshot(packed);
  if (isConfigured()) {
    await uploadSnapshot(packed);
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

function getLastSyncAt() {
  return lastSyncAt;
}

module.exports = {
  isConfigured,
  loadAll,
  persistAll,
  schedulePersist,
  exportSnapshot,
  getLastSyncAt,
  SNAPSHOT_FILENAME,
};
