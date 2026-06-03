const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { TICKET_IDS } = require('./components');
const store = require('../config/store');
const {
  buildPurchasePanelEmbed,
  buildSupportPanelEmbed,
} = require('./ticketUi');

const PANEL_TYPES = {
  purchase: 'purchase',
  support: 'support',
  renewal: 'renewal',
};

const DEFAULT_CATEGORIES = {
  payments: {
    id: 'payments',
    emoji: '🛒',
    buttonEmoji: '🛒',
    label: 'Open purchase lane',
    buttonStyle: ButtonStyle.Primary,
    description: 'Orders, payments, and access after purchase',
    sla: '90m',
    requiresPayment: true,
  },
  support: {
    id: 'support',
    emoji: '💬',
    buttonEmoji: '💬',
    label: 'Open support lane',
    buttonStyle: ButtonStyle.Secondary,
    description: 'General help and product questions',
    sla: '10m',
    requiresPayment: false,
  },
  scanner: {
    id: 'scanner',
    emoji: '🔍',
    buttonEmoji: '🔍',
    label: 'Report scanner issue',
    buttonStyle: ButtonStyle.Secondary,
    description: 'Scanner errors, detections, and troubleshooting',
    sla: '30m',
    requiresPayment: false,
  },
};

const DEFAULT_PANELS = {
  purchase: { categories: [DEFAULT_CATEGORIES.payments] },
  support: { categories: [DEFAULT_CATEGORIES.support, DEFAULT_CATEGORIES.scanner] },
  renewal: { categories: [DEFAULT_CATEGORIES.payments] },
};

function getPanelConfig(guildId, panelType) {
  const config = store.getGuild(guildId);
  const stored = config.tickets?.panels?.[panelType];
  const defaults = DEFAULT_PANELS[panelType];
  if (!defaults) return DEFAULT_PANELS.purchase;

  if (!stored?.categories?.length) {
    return { ...defaults };
  }

  return {
    categories: stored.categories.map((cat) => ({
      ...DEFAULT_CATEGORIES[cat.id],
      ...cat,
    })),
  };
}

function getAllCategories(guildId) {
  return [
    ...getPanelConfig(guildId, PANEL_TYPES.purchase).categories,
    ...getPanelConfig(guildId, PANEL_TYPES.support).categories,
  ];
}

function getCategoryById(guildId, categoryId) {
  return (
    DEFAULT_CATEGORIES[categoryId] ||
    getAllCategories(guildId).find((c) => c.id === categoryId) ||
    null
  );
}

function normalizeButtonEmoji(emoji, fallback = null) {
  if (!emoji || typeof emoji !== 'string') return fallback;
  if (/\u200D/.test(emoji)) return fallback || '🔍';
  const stripped = emoji.replace(/\uFE0F/g, '');
  return stripped.length > 0 ? stripped : emoji;
}

function buildTicketPanelPayload(guildId, panelType) {
  if (panelType === PANEL_TYPES.purchase) {
    return buildPurchasePanelEmbed(guildId);
  }
  if (panelType === PANEL_TYPES.renewal) {
    const { buildRenewalPanelEmbed } = require('./ticketPanelRenewal');
    return buildRenewalPanelEmbed(guildId);
  }
  return buildSupportPanelEmbed(guildId);
}

function ticketOpenButtonId(categoryId) {
  return `${TICKET_IDS.open}:${categoryId}`;
}

function parseTicketOpenCategory(customId) {
  if (customId === TICKET_IDS.open) return 'payments';
  if (!customId.startsWith(`${TICKET_IDS.open}:`)) return null;
  return customId.slice(`${TICKET_IDS.open}:`.length);
}

function buildTicketPanelRows(guildId, panelType) {
  const panel = getPanelConfig(guildId, panelType);
  const buttons = panel.categories.map((cat) => {
    const btn = new ButtonBuilder()
      .setCustomId(ticketOpenButtonId(cat.id))
      .setLabel(cat.label)
      .setStyle(cat.buttonStyle ?? ButtonStyle.Secondary);
    const buttonEmoji = normalizeButtonEmoji(cat.buttonEmoji || cat.emoji);
    if (buttonEmoji) btn.setEmoji(buttonEmoji);
    return btn;
  });

  const rows = [];
  for (let i = 0; i < buttons.length; i += 5) {
    rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
  }
  return rows;
}

module.exports = {
  PANEL_TYPES,
  DEFAULT_CATEGORIES,
  DEFAULT_PANELS,
  getPanelConfig,
  getAllCategories,
  getCategoryById,
  buildTicketPanelPayload,
  buildTicketPanelRows,
  ticketOpenButtonId,
  parseTicketOpenCategory,
};
