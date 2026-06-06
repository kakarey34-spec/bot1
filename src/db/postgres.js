const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const DATA_DIR = path.join(__dirname, '../../data');
const CONFIG_PATH = path.join(DATA_DIR, 'guild-config.json');
const TICKETS_PATH = path.join(DATA_DIR, 'active-tickets.json');
const LICENSES_PATH = path.join(DATA_DIR, 'licenses.json');
const COOLDOWNS_PATH = path.join(DATA_DIR, 'ticket-cooldowns.json');
const GIVEAWAYS_PATH = path.join(DATA_DIR, 'giveaways.json');

let pool = null;

function needsSsl(connectionString) {
  if (!connectionString) return false;
  return /sslmode=require/i.test(connectionString) || /\.render\.com/i.test(connectionString);
}

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: needsSsl(process.env.DATABASE_URL) ? { rejectUnauthorized: false } : undefined,
    });
  }
  return pool;
}

async function initSchema() {
  const p = getPool();
  await p.query(`
    CREATE TABLE IF NOT EXISTS guild_config (
      guild_id TEXT PRIMARY KEY,
      config JSONB NOT NULL DEFAULT '{}'
    );
    CREATE TABLE IF NOT EXISTS tickets (
      channel_id TEXT PRIMARY KEY,
      guild_id TEXT NOT NULL,
      data JSONB NOT NULL
    );
    CREATE INDEX IF NOT EXISTS tickets_guild_id_idx ON tickets (guild_id);
    CREATE TABLE IF NOT EXISTS licenses (
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      data JSONB NOT NULL,
      PRIMARY KEY (guild_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS ticket_cooldowns (
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      data JSONB NOT NULL,
      PRIMARY KEY (guild_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS giveaways (
      message_id TEXT PRIMARY KEY,
      guild_id TEXT NOT NULL,
      data JSONB NOT NULL
    );
    CREATE INDEX IF NOT EXISTS giveaways_guild_id_idx ON giveaways (guild_id);
  `);
}

function readJsonFile(filePath, fallback) {
  if (!fs.existsSync(filePath)) return structuredClone(fallback);
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return structuredClone(fallback);
  }
}

async function isEmpty() {
  const { rows } = await getPool().query('SELECT COUNT(*)::int AS count FROM guild_config');
  return rows[0].count === 0;
}

async function loadAll() {
  const p = getPool();
  const [guilds, tickets, licenses, cooldowns, giveaways] = await Promise.all([
    p.query('SELECT guild_id, config FROM guild_config'),
    p.query('SELECT channel_id, data FROM tickets'),
    p.query('SELECT guild_id, user_id, data FROM licenses'),
    p.query('SELECT guild_id, user_id, data FROM ticket_cooldowns'),
    p.query('SELECT message_id, data FROM giveaways'),
  ]);

  const cache = {};
  for (const row of guilds.rows) {
    cache[row.guild_id] = row.config;
  }

  const ticketsMap = {};
  for (const row of tickets.rows) {
    ticketsMap[row.channel_id] = row.data;
  }

  const licensesMap = {};
  for (const row of licenses.rows) {
    if (!licensesMap[row.guild_id]) licensesMap[row.guild_id] = {};
    licensesMap[row.guild_id][row.user_id] = row.data;
  }

  const cooldownsMap = {};
  for (const row of cooldowns.rows) {
    if (!cooldownsMap[row.guild_id]) cooldownsMap[row.guild_id] = {};
    cooldownsMap[row.guild_id][row.user_id] = row.data;
  }

  const giveawaysMap = {};
  for (const row of giveaways.rows) {
    giveawaysMap[row.message_id] = row.data;
  }

  return {
    cache,
    tickets: ticketsMap,
    licenses: licensesMap,
    cooldowns: cooldownsMap,
    giveaways: giveawaysMap,
  };
}

async function saveAllGuildConfig(cache) {
  const p = getPool();
  for (const [guildId, config] of Object.entries(cache)) {
    await p.query(
      `INSERT INTO guild_config (guild_id, config) VALUES ($1, $2::jsonb)
       ON CONFLICT (guild_id) DO UPDATE SET config = EXCLUDED.config`,
      [guildId, JSON.stringify(config)]
    );
  }
}

async function upsertTicket(channelId, data) {
  await getPool().query(
    `INSERT INTO tickets (channel_id, guild_id, data) VALUES ($1, $2, $3::jsonb)
     ON CONFLICT (channel_id) DO UPDATE SET guild_id = EXCLUDED.guild_id, data = EXCLUDED.data`,
    [channelId, data.guildId, JSON.stringify(data)]
  );
}

async function deleteTicket(channelId) {
  await getPool().query('DELETE FROM tickets WHERE channel_id = $1', [channelId]);
}

async function upsertLicense(guildId, userId, data) {
  await getPool().query(
    `INSERT INTO licenses (guild_id, user_id, data) VALUES ($1, $2, $3::jsonb)
     ON CONFLICT (guild_id, user_id) DO UPDATE SET data = EXCLUDED.data`,
    [guildId, userId, JSON.stringify(data)]
  );
}

async function upsertCooldown(guildId, userId, data) {
  await getPool().query(
    `INSERT INTO ticket_cooldowns (guild_id, user_id, data) VALUES ($1, $2, $3::jsonb)
     ON CONFLICT (guild_id, user_id) DO UPDATE SET data = EXCLUDED.data`,
    [guildId, userId, JSON.stringify(data)]
  );
}

async function deleteCooldown(guildId, userId) {
  await getPool().query('DELETE FROM ticket_cooldowns WHERE guild_id = $1 AND user_id = $2', [
    guildId,
    userId,
  ]);
}

async function upsertGiveaway(messageId, data) {
  await getPool().query(
    `INSERT INTO giveaways (message_id, guild_id, data) VALUES ($1, $2, $3::jsonb)
     ON CONFLICT (message_id) DO UPDATE SET guild_id = EXCLUDED.guild_id, data = EXCLUDED.data`,
    [messageId, data.guildId, JSON.stringify(data)]
  );
}

async function deleteGiveaway(messageId) {
  await getPool().query('DELETE FROM giveaways WHERE message_id = $1', [messageId]);
}

async function importJsonSnapshot(cache, tickets, licenses, cooldowns, giveaways) {
  const p = getPool();
  const client = await p.connect();
  try {
    await client.query('BEGIN');
    for (const [guildId, config] of Object.entries(cache)) {
      await client.query(
        `INSERT INTO guild_config (guild_id, config) VALUES ($1, $2::jsonb)
         ON CONFLICT (guild_id) DO NOTHING`,
        [guildId, JSON.stringify(config)]
      );
    }
    for (const [channelId, data] of Object.entries(tickets)) {
      await client.query(
        `INSERT INTO tickets (channel_id, guild_id, data) VALUES ($1, $2, $3::jsonb)
         ON CONFLICT (channel_id) DO NOTHING`,
        [channelId, data.guildId, JSON.stringify(data)]
      );
    }
    for (const [guildId, bucket] of Object.entries(licenses)) {
      for (const [userId, data] of Object.entries(bucket)) {
        await client.query(
          `INSERT INTO licenses (guild_id, user_id, data) VALUES ($1, $2, $3::jsonb)
           ON CONFLICT (guild_id, user_id) DO NOTHING`,
          [guildId, userId, JSON.stringify(data)]
        );
      }
    }
    for (const [guildId, bucket] of Object.entries(cooldowns)) {
      for (const [userId, data] of Object.entries(bucket)) {
        await client.query(
          `INSERT INTO ticket_cooldowns (guild_id, user_id, data) VALUES ($1, $2, $3::jsonb)
           ON CONFLICT (guild_id, user_id) DO NOTHING`,
          [guildId, userId, JSON.stringify(data)]
        );
      }
    }
    for (const [messageId, data] of Object.entries(giveaways)) {
      await client.query(
        `INSERT INTO giveaways (message_id, guild_id, data) VALUES ($1, $2, $3::jsonb)
         ON CONFLICT (message_id) DO NOTHING`,
        [messageId, data.guildId, JSON.stringify(data)]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function databaseHasData() {
  const p = getPool();
  const checks = await Promise.all([
    p.query('SELECT COUNT(*)::int AS count FROM guild_config'),
    p.query('SELECT COUNT(*)::int AS count FROM tickets'),
    p.query('SELECT COUNT(*)::int AS count FROM licenses'),
    p.query('SELECT COUNT(*)::int AS count FROM ticket_cooldowns'),
    p.query('SELECT COUNT(*)::int AS count FROM giveaways'),
  ]);
  return checks.some(({ rows }) => rows[0].count > 0);
}

async function exportDatabaseSnapshot() {
  const snapshot = await loadAll();
  return {
    version: 1,
    exported_at: new Date().toISOString(),
    snapshot,
  };
}

async function restoreFromSnapshot(snapshot) {
  const { cache = {}, tickets = {}, licenses = {}, cooldowns = {}, giveaways = {} } = snapshot || {};
  const p = getPool();
  const client = await p.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'TRUNCATE guild_config, tickets, licenses, ticket_cooldowns, giveaways RESTART IDENTITY'
    );
    for (const [guildId, config] of Object.entries(cache)) {
      await client.query(
        `INSERT INTO guild_config (guild_id, config) VALUES ($1, $2::jsonb)`,
        [guildId, JSON.stringify(config)]
      );
    }
    for (const [channelId, data] of Object.entries(tickets)) {
      await client.query(
        `INSERT INTO tickets (channel_id, guild_id, data) VALUES ($1, $2, $3::jsonb)`,
        [channelId, data.guildId, JSON.stringify(data)]
      );
    }
    for (const [guildId, bucket] of Object.entries(licenses)) {
      for (const [userId, data] of Object.entries(bucket)) {
        await client.query(
          `INSERT INTO licenses (guild_id, user_id, data) VALUES ($1, $2, $3::jsonb)`,
          [guildId, userId, JSON.stringify(data)]
        );
      }
    }
    for (const [guildId, bucket] of Object.entries(cooldowns)) {
      for (const [userId, data] of Object.entries(bucket)) {
        await client.query(
          `INSERT INTO ticket_cooldowns (guild_id, user_id, data) VALUES ($1, $2, $3::jsonb)`,
          [guildId, userId, JSON.stringify(data)]
        );
      }
    }
    for (const [messageId, data] of Object.entries(giveaways)) {
      await client.query(
        `INSERT INTO giveaways (message_id, guild_id, data) VALUES ($1, $2, $3::jsonb)`,
        [messageId, data.guildId, JSON.stringify(data)]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function initBackupMeta() {
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS _app_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

async function getMeta(key) {
  const { rows } = await getPool().query('SELECT value FROM _app_meta WHERE key = $1', [key]);
  return rows[0]?.value ?? null;
}

async function setMeta(key, value) {
  await getPool().query(
    `INSERT INTO _app_meta (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [key, value]
  );
}

async function migrateFromJsonIfEmpty() {
  if (!(await isEmpty())) return false;

  const cache = readJsonFile(CONFIG_PATH, {});
  const tickets = readJsonFile(TICKETS_PATH, {});
  const licenses = readJsonFile(LICENSES_PATH, {});
  const cooldowns = readJsonFile(COOLDOWNS_PATH, {});
  const giveaways = readJsonFile(GIVEAWAYS_PATH, {});

  const hasData =
    Object.keys(cache).length > 0 ||
    Object.keys(tickets).length > 0 ||
    Object.keys(licenses).length > 0 ||
    Object.keys(cooldowns).length > 0 ||
    Object.keys(giveaways).length > 0;

  if (!hasData) return false;

  await importJsonSnapshot(cache, tickets, licenses, cooldowns, giveaways);
  console.log('Imported existing data/*.json into PostgreSQL.');
  return true;
}

function persist(promise, label) {
  promise.catch((err) => console.error(`Postgres ${label}:`, err.message || err));
}

module.exports = {
  getPool,
  initSchema,
  loadAll,
  saveAllGuildConfig,
  upsertTicket,
  deleteTicket,
  upsertLicense,
  upsertCooldown,
  deleteCooldown,
  upsertGiveaway,
  deleteGiveaway,
  migrateFromJsonIfEmpty,
  databaseHasData,
  exportDatabaseSnapshot,
  restoreFromSnapshot,
  initBackupMeta,
  getMeta,
  setMeta,
  persist,
};
