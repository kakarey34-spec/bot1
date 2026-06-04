const fs = require('fs');
const path = require('path');
const defaults = require('./defaults');

const DATA_DIR = path.join(__dirname, '../../data');
const CONFIG_PATH = path.join(DATA_DIR, 'guild-config.json');
const TICKETS_PATH = path.join(DATA_DIR, 'active-tickets.json');
const LICENSES_PATH = path.join(DATA_DIR, 'licenses.json');
const COOLDOWNS_PATH = path.join(DATA_DIR, 'ticket-cooldowns.json');
const GIVEAWAYS_PATH = path.join(DATA_DIR, 'giveaways.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readJson(filePath, fallback) {
  ensureDataDir();
  if (!fs.existsSync(filePath)) {
    return structuredClone(fallback);
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return structuredClone(fallback);
  }
}

function writeJson(filePath, data) {
  ensureDataDir();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function deepMerge(target, source) {
  const out = { ...target };
  for (const key of Object.keys(source || {})) {
    if (
      source[key] &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === 'object' &&
      !Array.isArray(target[key])
    ) {
      out[key] = deepMerge(target[key], source[key]);
    } else {
      out[key] = source[key];
    }
  }
  return out;
}

class ConfigStore {
  constructor() {
    this._initialized = false;
    this._usePg = false;
    this._cache = {};
    this._tickets = {};
    this._licenses = {};
    this._cooldowns = {};
    this._giveaways = {};
  }

  async init() {
    if (this._initialized) return;

    this._usePg = Boolean(process.env.DATABASE_URL?.trim());

    if (this._usePg) {
      const pg = require('../db/postgres');
      await pg.initSchema();
      let imported = await pg.migrateFromJsonIfEmpty();
      const data = await pg.loadAll();
      this._cache = data.cache;
      this._tickets = data.tickets;
      this._licenses = data.licenses;
      this._cooldowns = data.cooldowns;
      this._giveaways = data.giveaways;
      this._pg = pg;
      console.log(
        imported
          ? 'Storage: PostgreSQL (migrated from data/*.json)'
          : 'Storage: PostgreSQL'
      );
    } else {
      this._cache = readJson(CONFIG_PATH, {});
      this._tickets = readJson(TICKETS_PATH, {});
      this._licenses = readJson(LICENSES_PATH, {});
      this._cooldowns = readJson(COOLDOWNS_PATH, {});
      this._giveaways = readJson(GIVEAWAYS_PATH, {});
      console.log('Storage: JSON files in data/ (set DATABASE_URL for PostgreSQL)');
    }

    this._initialized = true;
  }

  getGuild(guildId) {
    if (!this._cache[guildId]) {
      this._cache[guildId] = structuredClone(defaults);
      this.save();
    }
    return deepMerge(structuredClone(defaults), this._cache[guildId]);
  }

  setGuild(guildId, partial) {
    const current = this.getGuild(guildId);
    this._cache[guildId] = deepMerge(current, partial);
    this.save();
    return this.getGuild(guildId);
  }

  setPath(guildId, dotPath, value) {
    const config = this.getGuild(guildId);
    const keys = dotPath.split('.');
    let ref = config;
    for (let i = 0; i < keys.length - 1; i++) {
      if (ref[keys[i]] === undefined || typeof ref[keys[i]] !== 'object') {
        ref[keys[i]] = {};
      }
      ref = ref[keys[i]];
    }
    const last = keys[keys.length - 1];
    const parsed = tryParseValue(value);
    ref[last] = parsed;
    this._cache[guildId] = config;
    this.save();
    return parsed;
  }

  getPath(guildId, dotPath) {
    const config = this.getGuild(guildId);
    return dotPath.split('.').reduce((acc, key) => (acc != null ? acc[key] : undefined), config);
  }

  save() {
    if (this._usePg) {
      this._pg.persist(this._pg.saveAllGuildConfig(this._cache), 'save guild config');
    } else {
      writeJson(CONFIG_PATH, this._cache);
    }
  }

  getTicket(channelId) {
    return this._tickets[channelId] || null;
  }

  setTicket(channelId, data) {
    this._tickets[channelId] = data;
    if (this._usePg) {
      this._pg.persist(this._pg.upsertTicket(channelId, data), 'setTicket');
    } else {
      writeJson(TICKETS_PATH, this._tickets);
    }
  }

  deleteTicket(channelId) {
    delete this._tickets[channelId];
    if (this._usePg) {
      this._pg.persist(this._pg.deleteTicket(channelId), 'deleteTicket');
    } else {
      writeJson(TICKETS_PATH, this._tickets);
    }
  }

  listTicketsForGuild(guildId) {
    return Object.entries(this._tickets)
      .filter(([, t]) => t.guildId === guildId)
      .map(([channelId, t]) => ({ channelId, ...t }));
  }

  /** Any ticket for this user that is not closed (one open ticket per user per guild). */
  findOpenTicketByUser(guildId, userId) {
    return this.listTicketsForGuild(guildId).find(
      (t) => t.userId === userId && t.stage !== 'closed'
    );
  }

  _licenseBucket(guildId) {
    if (!this._licenses[guildId]) this._licenses[guildId] = {};
    return this._licenses[guildId];
  }

  getLicense(guildId, userId) {
    return this._licenseBucket(guildId)[userId] || null;
  }

  setLicense(guildId, userId, data) {
    this._licenseBucket(guildId)[userId] = data;
    if (this._usePg) {
      this._pg.persist(this._pg.upsertLicense(guildId, userId, data), 'setLicense');
    } else {
      writeJson(LICENSES_PATH, this._licenses);
    }
    return data;
  }

  listLicensesForGuild(guildId) {
    return Object.entries(this._licenseBucket(guildId)).map(([userId, license]) => ({
      userId,
      ...license,
    }));
  }

  _cooldownBucket(guildId) {
    if (!this._cooldowns[guildId]) this._cooldowns[guildId] = {};
    return this._cooldowns[guildId];
  }

  getTicketCooldown(guildId, userId) {
    return this._cooldownBucket(guildId)[userId] || null;
  }

  setTicketCooldown(guildId, userId, untilMs, reason = 'closed') {
    const row = { until: untilMs, reason, setAt: Date.now() };
    this._cooldownBucket(guildId)[userId] = row;
    if (this._usePg) {
      this._pg.persist(this._pg.upsertCooldown(guildId, userId, row), 'setTicketCooldown');
    } else {
      writeJson(COOLDOWNS_PATH, this._cooldowns);
    }
  }

  clearTicketCooldown(guildId, userId) {
    delete this._cooldownBucket(guildId)[userId];
    if (this._usePg) {
      this._pg.persist(this._pg.deleteCooldown(guildId, userId), 'clearTicketCooldown');
    } else {
      writeJson(COOLDOWNS_PATH, this._cooldowns);
    }
  }

  touchTicketActivity(channelId) {
    const ticket = this.getTicket(channelId);
    if (!ticket) return;
    ticket.lastActivityAt = Date.now();
    this.setTicket(channelId, ticket);
  }

  getGiveaway(messageId) {
    return this._giveaways[messageId] || null;
  }

  setGiveaway(messageId, data) {
    this._giveaways[messageId] = data;
    if (this._usePg) {
      this._pg.persist(this._pg.upsertGiveaway(messageId, data), 'setGiveaway');
    } else {
      writeJson(GIVEAWAYS_PATH, this._giveaways);
    }
  }

  deleteGiveaway(messageId) {
    delete this._giveaways[messageId];
    if (this._usePg) {
      this._pg.persist(this._pg.deleteGiveaway(messageId), 'deleteGiveaway');
    } else {
      writeJson(GIVEAWAYS_PATH, this._giveaways);
    }
  }

  listActiveGiveaways() {
    const now = Date.now();
    return Object.values(this._giveaways).filter(
      (g) => g.status === 'active' && g.endsAt > now
    );
  }

  pruneEndedGiveaways(maxAgeMs = 14 * 24 * 60 * 60 * 1000) {
    const cutoff = Date.now() - maxAgeMs;
    for (const [messageId, g] of Object.entries(this._giveaways)) {
      if (g.status === 'ended' && (g.endedAt || 0) < cutoff) {
        this.deleteGiveaway(messageId);
      }
    }
  }
}

function tryParseValue(value) {
  if (typeof value !== 'string') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;
  if (/^-?\d+$/.test(value)) return Number(value);
  if ((value.startsWith('[') && value.endsWith(']')) || (value.startsWith('{') && value.endsWith('}'))) {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

module.exports = new ConfigStore();
