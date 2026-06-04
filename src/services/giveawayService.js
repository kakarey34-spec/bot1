const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require('discord.js');
const store = require('../config/store');
const { getBrandColor } = require('../utils/brand');
const { formatDuration } = require('../utils/parseDuration');

const ENTER_PREFIX = 'giveaway_enter:';
const MAX_WINNERS = 20;
const GIVEAWAY_PING_ROLE_ID = '1511978380248092883';

function enterButton(messageId, disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${ENTER_PREFIX}${messageId}`)
      .setLabel('Enter giveaway')
      .setStyle(ButtonStyle.Success)
      .setEmoji('🎉')
      .setDisabled(disabled)
  );
}

function buildGiveawayEmbed(giveaway) {
  const endsUnix = Math.floor(giveaway.endsAt / 1000);
  const ended = giveaway.status === 'ended' || Date.now() >= giveaway.endsAt;
  const entries = giveaway.entrants?.length || 0;

  const embed = new EmbedBuilder()
    .setColor(ended ? 0x8b8b8b : getBrandColor())
    .setTitle(ended ? `🎉 Giveaway ended — ${giveaway.title}` : `🎉 ${giveaway.title}`)
    .setDescription(
      [
        `**Prize:** ${giveaway.prize}`,
        giveaway.description ? `\n${giveaway.description}` : '',
      ]
        .filter(Boolean)
        .join('\n')
    )
    .addFields(
      { name: 'Winners', value: String(giveaway.winnerCount), inline: true },
      { name: 'Entries', value: String(entries), inline: true },
      {
        name: ended ? 'Ended' : 'Ends',
        value: ended ? `<t:${endsUnix}:R>` : `<t:${endsUnix}:F> (<t:${endsUnix}:R>)`,
        inline: true,
      },
      { name: 'Hosted by', value: `<@${giveaway.hostId}>`, inline: true }
    )
    .setFooter({
      text: ended
        ? 'This giveaway has ended'
        : 'Click the button below to enter',
    })
    .setTimestamp(ended ? giveaway.endedAt || giveaway.endsAt : giveaway.endsAt);

  if (ended && giveaway.winnerIds?.length) {
    embed.addFields({
      name: 'Winner(s)',
      value: giveaway.winnerIds.map((id) => `<@${id}>`).join(', '),
    });
  } else if (ended) {
    embed.addFields({ name: 'Winner(s)', value: '_No valid entries_' });
  }

  return embed;
}

function pickWinners(entrants, count) {
  const pool = [...new Set(entrants)];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(count, pool.length));
}

async function refreshGiveawayMessage(client, giveaway) {
  const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
  if (!channel?.isTextBased()) return;
  const message = await channel.messages.fetch(giveaway.messageId).catch(() => null);
  if (!message) return;

  const ended = giveaway.status === 'ended';
  await message.edit({
    embeds: [buildGiveawayEmbed(giveaway)],
    components: ended ? [] : [enterButton(giveaway.messageId)],
  });
}

async function getValidEntrants(guild, giveaway) {
  const validEntrants = [];
  for (const userId of giveaway.entrants || []) {
    const member = await guild.members.fetch(userId).catch(() => null);
    if (member && !member.user.bot) validEntrants.push(userId);
  }
  return validEntrants;
}

async function endGiveaway(client, messageId, { force = false, endedBy = null } = {}) {
  const giveaway = store.getGiveaway(messageId);
  if (!giveaway) {
    return { error: 'Giveaway not found.' };
  }
  if (giveaway.status === 'ended') {
    return { error: 'Giveaway already ended. Use `/giveaway reroll` to replace invalid winners.' };
  }
  if (!force && Date.now() < giveaway.endsAt) {
    return { error: 'This giveaway is still running.' };
  }

  const guild = await client.guilds.fetch(giveaway.guildId).catch(() => null);
  if (!guild) {
    store.deleteGiveaway(messageId);
    return { error: 'Guild not found.' };
  }

  const validEntrants = await getValidEntrants(guild, giveaway);
  const winnerIds = pickWinners(validEntrants, giveaway.winnerCount);
  giveaway.status = 'ended';
  giveaway.endedAt = Date.now();
  giveaway.winnerIds = winnerIds;
  if (endedBy) giveaway.endedBy = endedBy;
  store.setGiveaway(messageId, giveaway);

  await refreshGiveawayMessage(client, giveaway);

  const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
  if (channel?.isTextBased()) {
    if (winnerIds.length === 0) {
      await channel
        .send({
          content: `Giveaway **${giveaway.title}** ended with no eligible entries.`,
        })
        .catch(() => null);
    } else {
      const mentions = winnerIds.map((id) => `<@${id}>`).join(' ');
      await channel
        .send({
          content: `🎉 Congratulations ${mentions}! You won **${giveaway.prize}** — ${giveaway.title}`,
          allowedMentions: { users: winnerIds },
        })
        .catch(() => null);
    }
  }

  return { ok: true, winnerIds, giveaway };
}

async function rerollGiveaway(client, messageId, replaceUserId) {
  const giveaway = store.getGiveaway(messageId);
  if (!giveaway) {
    return { error: 'Giveaway not found. It may be too old (ended records are kept for 14 days).' };
  }
  if (giveaway.status !== 'ended') {
    return { error: 'Only ended giveaways can be rerolled. End it first or wait for the timer.' };
  }

  const guild = await client.guilds.fetch(giveaway.guildId).catch(() => null);
  if (!guild) return { error: 'Guild not found.' };

  const winners = giveaway.winnerIds || [];
  if (!replaceUserId) {
    return { error: 'Specify the invalid winner with the `user` option.' };
  }
  if (!winners.includes(replaceUserId)) {
    return { error: 'That user is not a listed winner for this giveaway.' };
  }

  const pool = (await getValidEntrants(guild, giveaway)).filter(
    (id) => !winners.includes(id) || id === replaceUserId
  );
  const rerollPool = pool.filter((id) => id !== replaceUserId);
  if (!rerollPool.length) {
    return { error: 'No other eligible entrants to pick from.' };
  }

  const [newWinner] = pickWinners(rerollPool, 1);
  giveaway.winnerIds = winners.map((id) => (id === replaceUserId ? newWinner : id));
  giveaway.rerolls = [...(giveaway.rerolls || []), { from: replaceUserId, to: newWinner, at: Date.now() }];
  store.setGiveaway(messageId, giveaway);

  await refreshGiveawayMessage(client, giveaway);

  const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
  if (channel?.isTextBased()) {
    await channel
      .send({
        content: `🎉 Reroll: <@${newWinner}> you won **${giveaway.prize}** — ${giveaway.title} (replacing previous winner)`,
        allowedMentions: { users: [newWinner] },
      })
      .catch(() => null);
  }

  return { ok: true, newWinner, replaced: replaceUserId, giveaway };
}

async function handleEnter(interaction) {
  const messageId = interaction.customId.slice(ENTER_PREFIX.length);
  const giveaway = store.getGiveaway(messageId);

  if (!giveaway || giveaway.guildId !== interaction.guild.id) {
    return interaction.reply({
      content: 'This giveaway is no longer active.',
      ephemeral: true,
    });
  }

  if (giveaway.status === 'ended' || Date.now() >= giveaway.endsAt) {
    return interaction.reply({
      content: 'This giveaway has already ended.',
      ephemeral: true,
    });
  }

  if (interaction.user.bot) {
    return interaction.reply({ content: 'Bots cannot enter giveaways.', ephemeral: true });
  }

  const entrants = giveaway.entrants || [];
  if (entrants.includes(interaction.user.id)) {
    return interaction.reply({
      content: 'You are already entered in this giveaway.',
      ephemeral: true,
    });
  }

  giveaway.entrants = [...entrants, interaction.user.id];
  store.setGiveaway(messageId, giveaway);

  await refreshGiveawayMessage(interaction.client, giveaway);

  return interaction.reply({
    content: `You entered **${giveaway.title}**! Good luck — prize: **${giveaway.prize}**.`,
    ephemeral: true,
  });
}

async function startGiveaway(interaction, opts) {
  const durationMs = opts.durationMs;
  if (!durationMs || durationMs < 60 * 1000) {
    return { error: 'Duration must be at least 1 minute (e.g. `30m`, `1h`, `2d`).' };
  }
  if (durationMs > 365 * 24 * 60 * 60 * 1000) {
    return { error: 'Duration cannot be longer than 365 days.' };
  }

  const winnerCount = opts.winnerCount;
  if (winnerCount < 1 || winnerCount > MAX_WINNERS) {
    return { error: `Winner count must be between 1 and ${MAX_WINNERS}.` };
  }

  const channel = opts.channel || interaction.channel;
  if (!channel?.isTextBased()) {
    return { error: 'Choose a text channel for the giveaway.' };
  }

  const endsAt = Date.now() + durationMs;
  const preview = {
    title: opts.title,
    prize: opts.prize,
    description: opts.description || null,
    hostId: interaction.user.id,
    winnerCount,
    endsAt,
    entrants: [],
    status: 'active',
    guildId: interaction.guild.id,
    channelId: channel.id,
    messageId: 'pending',
  };

  const message = await channel.send({
    content: `<@&${GIVEAWAY_PING_ROLE_ID}>`,
    embeds: [buildGiveawayEmbed({ ...preview, messageId: 'pending' })],
    components: [enterButton('pending')],
    allowedMentions: { roles: [GIVEAWAY_PING_ROLE_ID] },
  });

  const giveaway = {
    ...preview,
    messageId: message.id,
    createdAt: Date.now(),
  };

  store.setGiveaway(message.id, giveaway);

  await message.edit({
    embeds: [buildGiveawayEmbed(giveaway)],
    components: [enterButton(message.id)],
  });

  return {
    ok: true,
    message,
    endsIn: formatDuration(durationMs),
  };
}

function isEnterButton(customId) {
  return customId.startsWith(ENTER_PREFIX);
}

module.exports = {
  ENTER_PREFIX,
  MAX_WINNERS,
  startGiveaway,
  endGiveaway,
  rerollGiveaway,
  handleEnter,
  isEnterButton,
  buildGiveawayEmbed,
};
