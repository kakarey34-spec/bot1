const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const store = require('../config/store');
const { formatPlanLabel, SITE_URL } = require('../constants/plans');
const { licenseStatus } = require('../services/licenseService');
const { brandFooter } = require('./brand');

function registryChannelId(guildId) {
  return store.getGuild(guildId).channels?.buyerRegistryChannelId || null;
}

function buildBuyerRegistryEmbed(guildId, userTag, userId, license) {
  const status = licenseStatus(license);
  const purchasedUnix = Math.floor(license.approvedAt / 1000);
  const expiresUnix = Math.floor(license.expiresAt / 1000);

  return new EmbedBuilder()
    .setColor(status.active ? 0x57f287 : 0xed4245)
    .setTitle(status.active ? '◆ Active buyer' : '◆ Expired license')
    .setDescription(`**${userTag}**`)
    .addFields(
      { name: 'User', value: `<@${userId}>`, inline: true },
      { name: 'Plan', value: formatPlanLabel(license.planId), inline: true },
      {
        name: 'Status',
        value: status.active ? '🟢 Active' : '🔴 Expired',
        inline: true,
      },
      { name: 'Purchased', value: `<t:${purchasedUnix}:F>`, inline: true },
      { name: 'Expires', value: `<t:${expiresUnix}:F>`, inline: true },
      {
        name: 'Months since purchase',
        value: String(status.monthsSincePurchase),
        inline: true,
      }
    )
    .setFooter(brandFooter(guildId))
    .setTimestamp();
}

async function getRegistryChannel(guild) {
  const channelId = registryChannelId(guild.id);
  if (!channelId) return null;
  return (
    guild.channels.cache.get(channelId) ||
    (await guild.channels.fetch(channelId).catch(() => null))
  );
}

async function upsertBuyerRegistry(guild, userId, license) {
  const channel = await getRegistryChannel(guild);
  if (!channel?.isTextBased()) return;

  const user = await guild.client.users.fetch(userId).catch(() => null);
  const userTag = user?.tag || userId;
  const embed = buildBuyerRegistryEmbed(guild.id, userTag, userId, license);

  const existingMessageId = license.registryMessageId;
  if (existingMessageId) {
    const msg = await channel.messages.fetch(existingMessageId).catch(() => null);
    if (msg) {
      await msg.edit({ embeds: [embed] }).catch(() => null);
      return;
    }
  }

  const msg = await channel.send({ embeds: [embed] }).catch(() => null);
  if (msg) {
    license.registryMessageId = msg.id;
    store.setLicense(guild.id, userId, license);
  }
}

module.exports = {
  buildBuyerRegistryEmbed,
  upsertBuyerRegistry,
};
