const { EmbedBuilder } = require('discord.js');
const store = require('../config/store');
const { formatPlanLabel } = require('../constants/plans');
const { brandFooter } = require('./brand');

function resolveLogChannelId(guild, categoryId) {
  const config = store.getGuild(guild.id);
  const categoryLogs = config.tickets.categoryLogChannels || {};
  return categoryLogs[categoryId] || config.tickets.logChannelId || null;
}

async function sendTicketLog(guild, categoryId, embed) {
  const logChannelId = resolveLogChannelId(guild, categoryId);
  if (!logChannelId) return;

  const logCh =
    guild.channels.cache.get(logChannelId) ||
    (await guild.channels.fetch(logChannelId).catch(() => null));
  if (!logCh?.isTextBased()) return;

  await logCh.send({ embeds: [embed] }).catch(() => null);
}

function baseLogEmbed(guildId, title, color = 0xd40000) {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setFooter(brandFooter(guildId))
    .setTimestamp();
}

async function logTicketOpened(guild, channel, ticket, member) {
  const embed = baseLogEmbed(guild.id, '◆ Ticket opened', 0x5865f2)
    .setDescription(`<#${channel.id}>`)
    .addFields(
      { name: 'User', value: `${member} (\`${member.id}\`)`, inline: true },
      { name: 'Category', value: `\`${ticket.category}\``, inline: true },
      { name: 'Stage', value: `\`${ticket.stage}\``, inline: true }
    );
  await sendTicketLog(guild, ticket.category, embed);
}

async function logTicketPlanSelected(guild, ticket, channelId, planId) {
  const embed = baseLogEmbed(guild.id, '◆ Plan selected', 0x5865f2)
    .setDescription(`<#${channelId}>`)
    .addFields(
      { name: 'User', value: `<@${ticket.userId}>`, inline: true },
      { name: 'Plan', value: formatPlanLabel(planId), inline: true }
    );
  await sendTicketLog(guild, ticket.category, embed);
}

async function logTicketAwaitingApproval(guild, ticket, channelId) {
  const embed = baseLogEmbed(guild.id, '◆ Awaiting approval', 0xfaa61a)
    .setDescription(`<#${channelId}>`)
    .addFields(
      { name: 'User', value: `<@${ticket.userId}>`, inline: true },
      { name: 'Plan', value: formatPlanLabel(ticket.planId), inline: true },
      { name: 'Payment', value: `\`${ticket.paymentMethod || '—'}\``, inline: true }
    );
  await sendTicketLog(guild, ticket.category, embed);
}

async function logTicketApproved(guild, ticket, channelId, staffMember) {
  const embed = baseLogEmbed(guild.id, '◆ Payment approved', 0x57f287)
    .setDescription(`<#${channelId}>`)
    .addFields(
      { name: 'User', value: `<@${ticket.userId}>`, inline: true },
      { name: 'Plan', value: formatPlanLabel(ticket.planId), inline: true },
      { name: 'Staff', value: `${staffMember}`, inline: true }
    );
  await sendTicketLog(guild, ticket.category, embed);
}

async function logTicketDenied(guild, ticket, channelId, staffMember, reason) {
  const embed = baseLogEmbed(guild.id, '◆ Payment denied', 0xed4245)
    .setDescription(`<#${channelId}>`)
    .addFields(
      { name: 'User', value: `<@${ticket.userId}>`, inline: true },
      { name: 'Plan', value: formatPlanLabel(ticket.planId), inline: true },
      { name: 'Staff', value: `${staffMember}`, inline: true },
      { name: 'Reason', value: reason?.slice(0, 1000) || '_No reason provided_', inline: false }
    );
  await sendTicketLog(guild, ticket.category, embed);
}

async function logTicketClosed(guild, ticket, channel, closedBy, transcript = null) {
  const logChannelId = resolveLogChannelId(guild, ticket?.category);
  if (!logChannelId) return;

  const logCh =
    guild.channels.cache.get(logChannelId) ||
    (await guild.channels.fetch(logChannelId).catch(() => null));
  if (!logCh?.isTextBased()) return;

  const embed = baseLogEmbed(guild.id, '◆ Ticket closed', 0x99aab5)
    .setDescription(`**#${channel.name}** closed by ${closedBy.user?.tag || closedBy}`)
    .addFields(
      { name: 'User', value: ticket ? `<@${ticket.userId}>` : '—', inline: true },
      { name: 'Category', value: ticket ? `\`${ticket.category}\`` : '—', inline: true },
      { name: 'Final stage', value: ticket ? `\`${ticket.stage}\`` : '—', inline: true }
    );

  await logCh
    .send({
      embeds: [embed],
      files: transcript ? [transcript] : [],
    })
    .catch(() => null);
}

module.exports = {
  logTicketOpened,
  logTicketPlanSelected,
  logTicketAwaitingApproval,
  logTicketApproved,
  logTicketDenied,
  logTicketClosed,
};
