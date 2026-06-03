const { EmbedBuilder } = require('discord.js');
const store = require('../config/store');
const { getBrandColor, brandFooter } = require('./brand');

function baseEmbed(guildId, title, description) {
  const embed = new EmbedBuilder()
    .setColor(getBrandColor())
    .setTimestamp();
  if (title) embed.setTitle(title);
  if (description) embed.setDescription(description);
  embed.setFooter(brandFooter(guildId));
  return embed;
}

function successEmbed(guildId, description) {
  return baseEmbed(guildId, 'Success', description).setColor(getBrandColor());
}

function errorEmbed(guildId, description) {
  return baseEmbed(guildId, 'Error', description).setColor(getBrandColor());
}

module.exports = { baseEmbed, successEmbed, errorEmbed };
