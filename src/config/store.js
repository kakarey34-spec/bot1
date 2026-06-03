const fs = require('fs');
const path = require('path');
const defaults = require('./defaults');

const DATA_DIR = path.join(__dirname, '../../data');
const CONFIG_PATH = path.join(DATA_DIR, 'guild-config.json');
const TICKETS_PATH = path.join(DATA_DIR, 'active-tickets.json');
const LICENSES_PATH = path.join(DATA_DIR, 'licenses.json');
const COOLDOWNS_PATH = path.join(DATA_DIR, 'ticket-cooldowns.json');

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
    this._cache = readJson(CONFIG_PATH, {});
    this._tickets = readJson(TICKETS_PATH, {});
    this._licenses = readJson(LICENSES_PATH, {});
    this._cooldowns = readJson(COOLDOWNS_PATH, {});
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
    writeJson(CONFIG_PATH, this._cache);
  }

  getTicket(channelId) {
    return this._tickets[channelId] || null;
  }

  setTicket(channelId, data) {
    this._tickets[channelId] = data;
    writeJson(TICKETS_PATH, this._tickets);
  }

  deleteTicket(channelId) {
    delete this._tickets[channelId];
    writeJson(TICKETS_PATH, this._tickets);
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
    writeJson(LICENSES_PATH, this._licenses);
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
    this._cooldownBucket(guildId)[userId] = { until: untilMs, reason, setAt: Date.now() };
    writeJson(COOLDOWNS_PATH, this._cooldowns);
  }

  clearTicketCooldown(guildId, userId) {
    delete this._cooldownBucket(guildId)[userId];
    writeJson(COOLDOWNS_PATH, this._cooldowns);
  }

  touchTicketActivity(channelId) {
    const ticket = this.getTicket(channelId);
    if (!ticket) return;
    ticket.lastActivityAt = Date.now();
    this.setTicket(channelId, ticket);
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
