const path = require('path');
const fs = require('fs');
const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const store = require('../config/store');

/** Virello brand palette (matches server logo). */
const BRAND = {
  red: 0xd40000,
  redBright: 0xff1a1a,
  black: 0x0a0a0a,
  white: 0xffffff,
  muted: 0x8b8b8b,
  success: 0x22c55e,
  warning: 0xf59e0b,
  danger: 0xdc2626,
};

const LOGO_PATH = path.join(__dirname, '../../assets/virello-logo.png');

const CHANNEL_PREFIX = {
  payments: 'buyticket',
  support: 'support',
  scanner: 'scanner',
};

function getBrandColor() {
  return BRAND.red;
}

function brandFooter(guildId) {
  const config = store.getGuild(guildId);
  return {
    text: config.embeds?.footer || 'VIRELLO',
    iconURL: logoExists() ? 'attachment://virello-logo.png' : undefined,
  };
}

function logoExists() {
  return fs.existsSync(LOGO_PATH);
}

function brandAttachment() {
  if (!logoExists()) return null;
  return new AttachmentBuilder(LOGO_PATH, { name: 'virello-logo.png' });
}

function withLogoPayload(embeds, extraFiles = []) {
  const files = [...extraFiles];
  const attachment = brandAttachment();
  if (attachment) files.unshift(attachment);

  const brandedEmbeds = embeds.map((embed) => {
    if (!attachment) return embed;
    const next = EmbedBuilder.from(embed.data);
    if (!next.data.thumbnail) {
      next.setThumbnail('attachment://virello-logo.png');
    }
    return next;
  });

  return { embeds: brandedEmbeds, files };
}

function getChannelPrefix(categoryId) {
  return CHANNEL_PREFIX[categoryId] || 'ticket';
}

function formatChannelName(prefix, username, suffix = '') {
  const slug = String(username || 'user')
    .replace(/[^a-z0-9-]/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 28);
  const base = suffix ? `${prefix}-${suffix}-${slug}` : `${prefix}-${slug}`;
  return base.slice(0, 100);
}

module.exports = {
  BRAND,
  LOGO_PATH,
  CHANNEL_PREFIX,
  getBrandColor,
  brandFooter,
  logoExists,
  brandAttachment,
  withLogoPayload,
  getChannelPrefix,
  formatChannelName,
};
