const zlib = require('zlib');

const DISCORD_API_BASE = 'https://discord.com/api/v10';
const DISCORD_TOKEN = process.env.DISCORD_TOKEN || process.env.DISCORD_BOT_TOKEN || '';
const DISCORD_BACKUP_CHANNEL_ID = process.env.DISCORD_BACKUP_CHANNEL_ID || '';
const BACKUP_INTERVAL_DAYS = Number(process.env.BACKUP_INTERVAL_DAYS || 29);
const BACKUP_CHECK_INTERVAL_MS = Number(process.env.BACKUP_CHECK_INTERVAL_SECONDS || 3600) * 1000;
const BACKUP_FILENAME_PREFIX = 'virellobot-db-backup-';

let pg = null;
let schedulerStarted = false;
let lastBackupAt = null;
let lastRestoreAt = null;

function usingPostgres() {
  return Boolean(process.env.DATABASE_URL?.trim());
}

function backupIsConfigured() {
  return Boolean(DISCORD_TOKEN && DISCORD_BACKUP_CHANNEL_ID);
}

function backupEnabled() {
  const value = (process.env.BACKUP_ENABLED || 'true').trim().toLowerCase();
  return !['0', 'false', 'no', 'off'].includes(value);
}

function backupAutoRestoreEnabled() {
  const value = (process.env.BACKUP_AUTO_RESTORE || '').trim().toLowerCase();
  if (['0', 'false', 'no', 'off'].includes(value)) return false;
  if (['1', 'true', 'yes', 'on'].includes(value)) return true;
  return backupIsConfigured() && usingPostgres();
}

function getPg() {
  if (!pg) pg = require('../db/postgres');
  return pg;
}

function backupFilename(exportedAt) {
  const safeTimestamp = exportedAt.replace(/:/g, '').replace('+00:00', 'Z');
  return `${BACKUP_FILENAME_PREFIX}${safeTimestamp}.json.gz`;
}

function serializeBackup(payload) {
  return zlib.gzipSync(JSON.stringify(payload));
}

function deserializeBackup(content) {
  try {
    return JSON.parse(zlib.gunzipSync(content).toString('utf8'));
  } catch {
    return JSON.parse(content.toString('utf8'));
  }
}

async function discordRequest(method, path, { body, headers = {} } = {}) {
  const response = await fetch(`${DISCORD_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bot ${DISCORD_TOKEN}`,
      'User-Agent': 'VirelloBotBackup/1.0',
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

async function uploadBackupToDiscord(filename, content, exportedAt) {
  const form = new FormData();
  form.append(
    'payload_json',
    JSON.stringify({
      content: `Virello Bot database backup (${exportedAt})`,
    })
  );
  form.append('files[0]', new Blob([content], { type: 'application/gzip' }), filename);
  return discordRequest('POST', `/channels/${DISCORD_BACKUP_CHANNEL_ID}/messages`, { body: form });
}

async function listBackupMessages(limit = 100) {
  return discordRequest('GET', `/channels/${DISCORD_BACKUP_CHANNEL_ID}/messages?limit=${limit}`);
}

function attachmentFromMessage(message) {
  for (const attachment of message.attachments || []) {
    if (attachment.filename?.startsWith(BACKUP_FILENAME_PREFIX)) {
      return attachment;
    }
  }
  return null;
}

function parseBackupTimestamp(message, attachment) {
  const filename = attachment.filename || '';
  if (filename.startsWith(BACKUP_FILENAME_PREFIX)) {
    const raw = filename
      .slice(BACKUP_FILENAME_PREFIX.length)
      .replace(/\.json\.gz$/, '');
    const parsed = Date.parse(raw.endsWith('Z') ? raw : `${raw}Z`);
    if (!Number.isNaN(parsed)) return new Date(parsed);
  }
  const parsed = Date.parse(message.timestamp);
  return Number.isNaN(parsed) ? null : new Date(parsed);
}

async function findLatestBackupMessage() {
  const messages = await listBackupMessages();
  let latest = null;
  for (const message of messages) {
    const attachment = attachmentFromMessage(message);
    if (!attachment) continue;
    const createdAt = parseBackupTimestamp(message, attachment);
    if (!createdAt) continue;
    if (!latest || createdAt > latest.createdAt) {
      latest = { message, attachment, createdAt };
    }
  }
  return latest;
}

async function downloadLatestBackup() {
  const latest = await findLatestBackupMessage();
  if (!latest?.attachment?.url) return null;
  const response = await fetch(latest.attachment.url, {
    headers: { 'User-Agent': 'VirelloBotBackup/1.0' },
  });
  if (!response.ok) {
    throw new Error(`Backup download failed (${response.status})`);
  }
  const content = Buffer.from(await response.arrayBuffer());
  return deserializeBackup(content);
}

async function getLastBackupAt() {
  if (lastBackupAt) return lastBackupAt;
  const database = getPg();
  const stored = await database.getMeta('last_backup_at');
  if (stored) {
    lastBackupAt = stored;
    return stored;
  }
  if (!backupIsConfigured()) return null;
  try {
    const latest = await findLatestBackupMessage();
    if (!latest) return null;
    lastBackupAt = latest.message.timestamp;
    return lastBackupAt;
  } catch {
    return null;
  }
}

async function getLastRestoreAt() {
  if (lastRestoreAt) return lastRestoreAt;
  const database = getPg();
  return database.getMeta('last_restore_at');
}

async function backupIsDue() {
  const previous = await getLastBackupAt();
  if (!previous) return true;
  const elapsedMs = Date.now() - Date.parse(previous);
  return elapsedMs >= BACKUP_INTERVAL_DAYS * 24 * 60 * 60 * 1000;
}

async function createAndUploadBackup() {
  if (!backupIsConfigured()) {
    throw new Error('Discord backup is not configured.');
  }
  const database = getPg();
  const payload = await database.exportDatabaseSnapshot();
  const exportedAt = payload.exported_at;
  const filename = backupFilename(exportedAt);
  const content = serializeBackup(payload);
  await uploadBackupToDiscord(filename, content, exportedAt);
  lastBackupAt = exportedAt;
  await database.setMeta('last_backup_at', exportedAt);
  console.log(`Database backup uploaded to Discord (${filename}, ${content.length} bytes).`);
}

async function maybeRestoreFromBackup() {
  if (!backupAutoRestoreEnabled() || !backupIsConfigured() || !usingPostgres()) {
    return false;
  }
  const database = getPg();
  if (await database.databaseHasData()) {
    return false;
  }
  try {
    const backup = await downloadLatestBackup();
    if (!backup?.snapshot) {
      console.log('Backup restore skipped: no Virello Bot backup found in Discord channel.');
      return false;
    }
    await database.restoreFromSnapshot(backup.snapshot);
    const restoredAt = new Date().toISOString();
    lastRestoreAt = restoredAt;
    await database.setMeta('last_restore_at', restoredAt);
    console.log(`Database restored from Discord backup exported at ${backup.exported_at || 'unknown'}.`);
    return true;
  } catch (error) {
    console.error('Backup restore failed:', error.message || error);
    return false;
  }
}

async function maybeRunScheduledBackup() {
  if (!backupEnabled() || !backupIsConfigured() || !usingPostgres()) {
    return false;
  }
  if (!(await backupIsDue())) return false;
  if (!(await getPg().databaseHasData())) return false;
  try {
    await createAndUploadBackup();
    return true;
  } catch (error) {
    console.error('Scheduled backup failed:', error.message || error);
    return false;
  }
}

async function initializeBackupSystem() {
  if (!usingPostgres()) return;
  const database = getPg();
  await database.initBackupMeta();
  await maybeRestoreFromBackup();
  if (backupEnabled() && backupIsConfigured() && (await backupIsDue()) && (await database.databaseHasData())) {
    await maybeRunScheduledBackup();
  }
}

function startScheduler() {
  if (schedulerStarted || !backupEnabled() || !backupIsConfigured() || !usingPostgres()) {
    return;
  }
  schedulerStarted = true;
  setInterval(() => {
    maybeRunScheduledBackup().catch((error) => {
      console.error('Backup scheduler error:', error.message || error);
    });
  }, BACKUP_CHECK_INTERVAL_MS);
  console.log(
    `Backup scheduler started (every ${BACKUP_INTERVAL_DAYS} days, checked hourly).`
  );
}

async function checkDatabaseConnection() {
  if (!usingPostgres()) return true;
  try {
    await getPg().getPool().query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

async function getHealthStatus() {
  const store = require('../config/store');
  const engine = store.getStorageEngine?.() || (usingPostgres() ? 'postgresql' : 'json');
  const discordSync = require('../db/discordSync');

  if (engine === 'discord') {
    return {
      status: discordSync.isConfigured() ? 'ok' : 'degraded',
      service: 'virellobot',
      timestamp: new Date().toISOString(),
      database: {
        connected: discordSync.isConfigured(),
        engine: 'discord-txt',
        has_data: true,
      },
      backup: {
        enabled: backupEnabled(),
        configured: discordSync.isConfigured(),
        auto_restore_enabled: discordSync.isConfigured(),
        interval_days: BACKUP_INTERVAL_DAYS,
        last_backup_at: discordSync.getLastSyncAt(),
        last_restore_at: null,
        sync_channel: process.env.DISCORD_SYNC_CHANNEL_ID || DISCORD_BACKUP_CHANNEL_ID || null,
        snapshot_file: discordSync.SNAPSHOT_FILENAME,
      },
    };
  }

  const databaseConnected = await checkDatabaseConnection();
  const database = usingPostgres() ? getPg() : null;
  return {
    status: databaseConnected ? 'ok' : 'degraded',
    service: 'virellobot',
    timestamp: new Date().toISOString(),
    database: {
      connected: databaseConnected,
      engine: usingPostgres() ? 'postgresql' : 'json',
      has_data: database && databaseConnected ? await database.databaseHasData() : false,
    },
    backup: {
      enabled: backupEnabled(),
      configured: backupIsConfigured(),
      auto_restore_enabled: backupAutoRestoreEnabled(),
      interval_days: BACKUP_INTERVAL_DAYS,
      last_backup_at: await getLastBackupAt(),
      last_restore_at: await getLastRestoreAt(),
    },
  };
}

async function restoreLatestBackup({ force = false } = {}) {
  if (!backupIsConfigured() || !usingPostgres()) {
    throw new Error('PostgreSQL and Discord backup must be configured.');
  }
  const database = getPg();
  if (!force && (await database.databaseHasData())) {
    throw new Error('Database is not empty. Use force=true or the web /admin restore with confirmation.');
  }
  const backup = await downloadLatestBackup();
  if (!backup?.snapshot) {
    throw new Error('No Virello Bot backup found in the Discord channel.');
  }
  await database.restoreFromSnapshot(backup.snapshot);
  const restoredAt = new Date().toISOString();
  lastRestoreAt = restoredAt;
  await database.setMeta('last_restore_at', restoredAt);
  return { ok: true, exported_at: backup.exported_at || null };
}

module.exports = {
  initializeBackupSystem,
  startScheduler,
  getHealthStatus,
  maybeRunScheduledBackup,
  createAndUploadBackup,
  restoreLatestBackup,
};
