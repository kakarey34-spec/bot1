const { EmbedBuilder } = require('discord.js');
const store = require('../config/store');
const { formatPlanLabel } = require('../constants/plans');
const { brandFooter } = require('./brand');

function resolveLogChannelId(guild, categoryId) {
  const config = store.getGuild(guild.id);
  const categoryLogs = config.tickets.categoryLogChannels || {};
  return categoryLogs[categoryId] || config.tickets.logChannelId || null;
}

function baseLogEmbed(guildId, title, color = 0xd40000) {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setFooter(brandFooter(guildId))
    .setTimestamp();
}

async function logTicketClosed(guild, ticket, channel, closedBy, transcriptData = null) {
  const logChannelId = resolveLogChannelId(guild, ticket?.category);
  if (!logChannelId) return;

  const logCh =
    guild.channels.cache.get(logChannelId) ||
    (await guild.channels.fetch(logChannelId).catch(() => null));
  if (!logCh?.isTextBased()) return;

  const closedByLabel =
    closedBy.user?.tag || closedBy.tag || closedBy.username || String(closedBy);
  const openedUnix = Math.floor((ticket?.createdAt || channel.createdTimestamp) / 1000);
  const closedUnix = Math.floor(Date.now() / 1000);

  const embed = baseLogEmbed(guild.id, '◆ Ticket closed — final transcript', 0x99aab5)
    .setDescription(`**#${channel.name}** · \`${channel.id}\``)
    .addFields(
      { name: 'User', value: ticket ? `<@${ticket.userId}>` : '—', inline: true },
      { name: 'Category', value: ticket ? `\`${ticket.category}\`` : '—', inline: true },
      { name: 'Final stage', value: ticket ? `\`${ticket.stage}\`` : '—', inline: true },
      { name: 'Closed by', value: closedByLabel, inline: true },
      { name: 'Opened', value: `<t:${openedUnix}:F>`, inline: true },
      { name: 'Closed', value: `<t:${closedUnix}:F>`, inline: true }
    );

  if (ticket?.planId) {
    embed.addFields({ name: 'Plan', value: formatPlanLabel(ticket.planId), inline: true });
  }
  if (ticket?.paymentMethod) {
    embed.addFields({ name: 'Payment', value: `\`${ticket.paymentMethod}\``, inline: true });
  }
  if (ticket?.denyReason) {
    embed.addFields({ name: 'Deny reason', value: ticket.denyReason.slice(0, 500), inline: false });
  }

  if (transcriptData?.messageCount != null) {
    embed.addFields({
      name: 'Messages',
      value: String(transcriptData.messageCount),
      inline: true,
    });
  }

  if (transcriptData?.preview) {
    const snippet = transcriptData.preview.slice(0, 900);
    embed.addFields({
      name: 'Transcript preview',
      value: `\`\`\`\n${snippet}${transcriptData.preview.length > 900 ? '…' : ''}\n\`\`\``,
      inline: false,
    });
  }

  embed.addFields({
    name: 'Full transcript',
    value: transcriptData?.attachment
      ? '📎 Attached as `.txt` file below.'
      : '_No messages captured._',
    inline: false,
  });

  await logCh
    .send({
      embeds: [embed],
      files: transcriptData?.attachment ? [transcriptData.attachment] : [],
    })
    .catch(() => null);
}

module.exports = {
  logTicketClosed,
};
