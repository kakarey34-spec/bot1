const { AttachmentBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const store = require('../config/store');
const { getChannelPrefix, formatChannelName } = require('../utils/brand');
const {
  buildTicketWelcome,
  buildPaymentMethodEmbed,
  buildProofRequestEmbed,
  buildProofReceivedEmbed,
  buildStaffReviewEmbed,
  buildApprovedEmbed,
  buildDeniedEmbed,
  buildClosedEmbed,
} = require('../utils/ticketUi');
const {
  planSelectionRow,
  paymentMethodRow,
  paymentDoneRow,
  staffApprovalRow,
} = require('../utils/components');
const licenseService = require('./licenseService');
const ticketLog = require('../utils/ticketLog');
const { getPlan } = require('../constants/plans');

const { getCategoryById, DEFAULT_CATEGORIES } = require('../utils/ticketPanel');

const STAGES = {
  SELECT_PLAN: 'select_plan',
  SELECT_PAYMENT: 'select_payment',
  AWAITING_PAYMENT: 'awaiting_payment',
  AWAITING_PROOF: 'awaiting_proof',
  AWAITING_APPROVAL: 'awaiting_approval',
  AWAITING_STAFF: 'awaiting_staff',
  APPROVED: 'approved',
  DENIED: 'denied',
  CLOSED: 'closed',
};

const STAFF_CHANNEL_PERMS = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.AttachFiles,
  PermissionFlagsBits.ReadMessageHistory,
  PermissionFlagsBits.ManageChannels,
];

/** Prevents double channel creation when the open button is clicked twice quickly. */
const ticketCreationLocks = new Set();

function slugUsername(username) {
  const slug = String(username || 'user')
    .replace(/[^a-z0-9-]/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return slug.slice(0, 32) || 'user';
}

/** Roles and users allowed to see ticket channels (besides the ticket owner and bot). */
function collectTicketViewers(config) {
  const roleIds = new Set();
  const userIds = new Set();

  for (const lists of [
    config.tickets.supportRoleIds,
    config.tickets.viewerRoleIds,
    config.roles.staffRoleIds,
    config.whitelist.staffRoleIds,
    config.whitelist.adminRoleIds,
  ]) {
    for (const id of lists || []) {
      if (id) roleIds.add(id);
    }
  }

  for (const id of config.tickets.viewerUserIds || []) {
    if (id) userIds.add(id);
  }

  return { roleIds: [...roleIds], userIds: [...userIds] };
}

function buildTicketPermissionOverwrites(guild, ticketOwnerId, config) {
  const overwrites = [
    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id: ticketOwnerId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    },
    {
      id: guild.members.me.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ManageChannels,
      ],
    },
  ];

  const { roleIds, userIds } = collectTicketViewers(config);

  for (const roleId of roleIds) {
    overwrites.push({
      id: roleId,
      allow: STAFF_CHANNEL_PERMS,
    });
  }

  for (const userId of userIds) {
    if (userId === ticketOwnerId) continue;
    overwrites.push({
      id: userId,
      allow: STAFF_CHANNEL_PERMS,
    });
  }

  return overwrites;
}

function ticketChannelName(stage, username, config, categoryId) {
  const prefix = getChannelPrefix(categoryId);

  if (stage === STAGES.AWAITING_APPROVAL) {
    return formatChannelName(prefix, username, 'pending');
  }
  if (stage === STAGES.APPROVED) {
    return formatChannelName(prefix, username, 'complete');
  }
  if (stage === STAGES.DENIED) {
    return formatChannelName(prefix, username, 'declined');
  }
  return formatChannelName(prefix, username);
}

async function syncTicketChannelName(channel, ticket, config) {
  const member = await channel.guild.members.fetch(ticket.userId).catch(() => null);
  const username = member?.user?.username || 'user';
  const name = ticketChannelName(ticket.stage, username, config, ticket.category);
  if (channel.name === name) return;
  await channel.setName(name).catch((err) => {
    console.warn(`Could not rename ticket channel ${channel.id}:`, err.message);
  });
}

function ticketTopicForUser(member, categoryId) {
  const category = getCategoryById(member.guild.id, categoryId);
  const label = category?.label || categoryId || 'ticket';
  return `VIRELLO ${label} · ${member.user.tag} (${member.id})`;
}

function channelOwnedByUser(channel, userId) {
  return channel.topic?.includes(`(${userId})`);
}

/**
 * Returns the user's single open ticket in this guild, if any.
 * Cleans up store entries when the channel was deleted.
 * Re-links orphan ticket channels (channel exists but store entry missing).
 */
async function findActiveUserTicket(guild, userId) {
  const config = store.getGuild(guild.id);
  const open = store.findOpenTicketByUser(guild.id, userId);

  if (open) {
    const ch = guild.channels.cache.get(open.channelId);
    if (ch) {
      return { ticket: open, channel: ch };
    }
    store.deleteTicket(open.channelId);
  }

  const categoryId = config.tickets.categoryId;
  for (const ch of guild.channels.cache.values()) {
    if (ch.type !== ChannelType.GuildText) continue;
    if (categoryId && ch.parentId !== categoryId) continue;
    if (!channelOwnedByUser(ch, userId)) continue;

    let ticket = store.getTicket(ch.id);
    if (!ticket) {
      ticket = {
        guildId: guild.id,
        userId,
        stage: STAGES.SELECT_PAYMENT,
        paymentMethod: null,
        createdAt: Date.now(),
        recovered: true,
      };
      store.setTicket(ch.id, ticket);
    } else if (ticket.stage === STAGES.CLOSED) {
      continue;
    }

    return { ticket, channel: ch };
  }

  return null;
}

function openTicketErrorMessage(channel) {
  return {
    error: `You already have an open ticket. Please use your existing channel: ${channel}. Close it with staff help before opening another.`,
  };
}

function isPaymentCategory(categoryId) {
  return categoryId === 'payments' || DEFAULT_CATEGORIES[categoryId]?.requiresPayment === true;
}

function checkOpenCooldown(guildId, userId) {
  const config = store.getGuild(guildId);
  const cooldown = store.getTicketCooldown(guildId, userId);
  if (!cooldown || cooldown.until <= Date.now()) return null;

  const minutes = Math.ceil((cooldown.until - Date.now()) / 60000);
  return `You must wait **${minutes} minute(s)** before opening another purchase lane (${cooldown.reason || 'cooldown'}).`;
}

function applyPurchaseCooldown(guildId, userId, reason) {
  const config = store.getGuild(guildId);
  const minutes = config.tickets.openCooldownMinutes ?? 30;
  if (minutes <= 0) return;
  store.setTicketCooldown(guildId, userId, Date.now() + minutes * 60 * 1000, reason);
}

async function sendTicketOpeningMessages(channel, guild, member, ticketData, config) {
  const category = getCategoryById(guild.id, ticketData.category);
  const requiresPayment = category?.requiresPayment === true;
  const welcomePayload = buildTicketWelcome(guild.id, category, member);

  if (requiresPayment) {
    ticketData.stage = STAGES.SELECT_PLAN;
    store.setTicket(channel.id, ticketData);
    await channel.send({
      ...welcomePayload,
      components: planSelectionRow(),
    });
    return;
  }

  ticketData.stage = STAGES.AWAITING_STAFF;
  store.setTicket(channel.id, ticketData);
  await channel.send(welcomePayload);
}

async function createTicket(guild, member, categoryId = 'payments') {
  const lockKey = `${guild.id}:${member.id}`;
  if (ticketCreationLocks.has(lockKey)) {
    return { error: 'Your ticket is already being created. Please wait a moment.' };
  }

  const existingBeforeLock = await findActiveUserTicket(guild, member.id);
  if (existingBeforeLock) {
    return openTicketErrorMessage(existingBeforeLock.channel);
  }

  ticketCreationLocks.add(lockKey);
  try {
    const existing = await findActiveUserTicket(guild, member.id);
    if (existing) {
      return openTicketErrorMessage(existing.channel);
    }

    const config = store.getGuild(guild.id);
    const category = getCategoryById(guild.id, categoryId);
    if (!category) {
      return { error: 'Unknown ticket category. Ask an admin to refresh the ticket panel.' };
    }

    if (category.requiresPayment) {
      const cooldownMsg = checkOpenCooldown(guild.id, member.id);
      if (cooldownMsg) return { error: cooldownMsg };
    }

    const overwrites = buildTicketPermissionOverwrites(guild, member.id, config);

    const channel = await guild.channels.create({
      name: ticketChannelName(
        category.requiresPayment ? STAGES.SELECT_PLAN : STAGES.AWAITING_STAFF,
        member.user.username,
        config,
        categoryId
      ),
      type: ChannelType.GuildText,
      parent: config.tickets.categoryId || undefined,
      permissionOverwrites: overwrites,
      topic: ticketTopicForUser(member, categoryId),
    });

    const ticketData = {
      guildId: guild.id,
      userId: member.id,
      category: categoryId,
      stage: category.requiresPayment ? STAGES.SELECT_PLAN : STAGES.AWAITING_STAFF,
      planId: null,
      paymentMethod: null,
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
    };
    store.setTicket(channel.id, ticketData);

    await sendTicketOpeningMessages(channel, guild, member, ticketData, config);
    await ticketLog.logTicketOpened(guild, channel, ticketData, member);

    return { channel, ticketData };
  } finally {
    ticketCreationLocks.delete(lockKey);
  }
}

async function selectPlan(channel, userId, planId) {
  const ticket = store.getTicket(channel.id);
  if (!ticket || ticket.userId !== userId) {
    return { error: 'This ticket does not belong to you or is invalid.' };
  }
  if (ticket.stage !== STAGES.SELECT_PLAN) {
    return { error: 'A plan was already selected.' };
  }

  const plan = getPlan(planId);
  if (!plan) return { error: 'Unknown license plan.' };

  const config = store.getGuild(channel.guild.id);
  ticket.planId = planId;
  ticket.stage = STAGES.SELECT_PAYMENT;
  ticket.lastActivityAt = Date.now();
  store.setTicket(channel.id, ticket);

  const enabledMethods = Object.entries(config.payments).filter(([, m]) => m.enabled !== false);
  await channel.send({
    content: `**${plan.label}** selected (${plan.price}${plan.term}). Choose your payment method:`,
    components: paymentMethodRow(enabledMethods),
  });

  await ticketLog.logTicketPlanSelected(channel.guild, ticket, channel.id, planId);
  return { ok: true };
}

async function selectPaymentMethod(channel, userId, methodKey) {
  const ticket = store.getTicket(channel.id);
  if (!ticket || ticket.userId !== userId) {
    return { error: 'This ticket does not belong to you or is invalid.' };
  }
  if (ticket.stage !== STAGES.SELECT_PAYMENT && ticket.stage !== STAGES.AWAITING_PAYMENT) {
    return { error: 'Payment method was already selected.' };
  }
  if (!ticket.planId) {
    return { error: 'Select a license plan first.' };
  }

  const config = store.getGuild(channel.guild.id);
  const method = config.payments[methodKey];
  if (!method || method.enabled === false) {
    return { error: 'That payment method is not available.' };
  }

  ticket.paymentMethod = methodKey;
  ticket.stage = STAGES.AWAITING_PAYMENT;
  ticket.lastActivityAt = Date.now();
  store.setTicket(channel.id, ticket);

  await channel.send({
    ...buildPaymentMethodEmbed(channel.guild.id, method, methodKey),
    components: paymentDoneRow(),
  });

  return { ok: true };
}

async function markPaymentDone(channel, userId) {
  const ticket = store.getTicket(channel.id);
  if (!ticket) return { error: 'Not a ticket channel.' };
  if (ticket.userId !== userId) return { error: 'Only the ticket owner can confirm payment.' };
  if (ticket.stage !== STAGES.AWAITING_PAYMENT) {
    return { error: 'You are not at the payment confirmation step.' };
  }

  const config = store.getGuild(channel.guild.id);
  ticket.stage = STAGES.AWAITING_PROOF;
  ticket.lastActivityAt = Date.now();
  store.setTicket(channel.id, ticket);

  await channel.send(
    buildProofRequestEmbed(channel.guild.id, config.tickets.awaitingProofMessage)
  );

  return { ok: true };
}

async function handleProofMessage(message) {
  const ticket = store.getTicket(message.channel.id);
  if (!ticket || ticket.stage !== STAGES.AWAITING_PROOF) return false;
  if (message.author.id !== ticket.userId) return false;

  const config = store.getGuild(message.guild.id);
  const hasAttachment = message.attachments.size > 0;
  const hasContent = message.content && message.content.trim().length > 2;

  if (!hasAttachment && !hasContent) return false;

  ticket.stage = STAGES.AWAITING_APPROVAL;
  ticket.proofMessageId = message.id;
  ticket.proofAt = Date.now();
  ticket.lastActivityAt = Date.now();
  store.setTicket(message.channel.id, ticket);

  await syncTicketChannelName(message.channel, ticket, config);

  await message.reply(buildProofReceivedEmbed(message.guild.id, config.tickets.waitingApprovalMessage));

  const { roleIds: viewerRoleIds } = collectTicketViewers(config);
  const staffPing = viewerRoleIds.map((id) => `<@&${id}>`).join(' ');

  await message.channel.send({
    content: staffPing || null,
    ...buildStaffReviewEmbed(message.guild.id, ticket, message.url),
    components: staffApprovalRow(message.channel.id),
  });

  await ticketLog.logTicketAwaitingApproval(message.guild, ticket, message.channel.id);
  return true;
}

async function handleDoneKeyword(message) {
  if (!message.content || !/^done$/i.test(message.content.trim())) return false;
  const ticket = store.getTicket(message.channel.id);
  if (!ticket || message.author.id !== ticket.userId) return false;
  if (ticket.stage !== STAGES.AWAITING_PAYMENT) return false;
  const result = await markPaymentDone(message.channel, message.author.id);
  if (result.error) {
    await message.reply({ content: result.error });
    return true;
  }
  return true;
}

async function approvePayment(guild, channelId, staffMember) {
  const channel = guild.channels.cache.get(channelId);
  if (!channel) return { error: 'Ticket channel not found.' };

  const ticket = store.getTicket(channelId);
  if (!ticket) return { error: 'Not a valid ticket.' };
  if (ticket.stage !== STAGES.AWAITING_APPROVAL) {
    return { error: 'This ticket is not awaiting approval.' };
  }

  const config = store.getGuild(guild.id);
  const member = await guild.members.fetch(ticket.userId).catch(() => null);

  if (!ticket.planId) {
    return { error: 'No license plan on this ticket — ask the buyer to re-select a plan.' };
  }

  if (config.roles.purchaserRoleId && member) {
    await member.roles.add(config.roles.purchaserRoleId, 'Payment approved').catch(() => null);
  }

  const licenseResult = licenseService.grantLicense(guild.id, ticket.userId, ticket.planId, {
    approvedBy: staffMember.id,
    approvedAt: Date.now(),
    ticketChannelId: channelId,
  });

  ticket.stage = STAGES.APPROVED;
  ticket.approvedBy = staffMember.id;
  ticket.approvedAt = Date.now();
  store.setTicket(channelId, ticket);

  await syncTicketChannelName(channel, ticket, config);

  await channel.send({
    content: `<@${ticket.userId}>`,
    ...buildApprovedEmbed(guild.id, config.tickets.approvedMessage),
  });

  if (member && licenseResult.ok) {
    await licenseService.sendWelcomeDm(member, guild.id, licenseResult.license, licenseResult.plan);
  }

  await ticketLog.logTicketApproved(guild, ticket, channelId, staffMember);
  store.clearTicketCooldown(guild.id, ticket.userId);

  return { ok: true, member, license: licenseResult.license };
}

async function denyPayment(guild, channelId, staffMember, reason = null) {
  const channel = guild.channels.cache.get(channelId);
  if (!channel) return { error: 'Ticket channel not found.' };

  const ticket = store.getTicket(channelId);
  if (!ticket) return { error: 'Not a valid ticket.' };

  const config = store.getGuild(guild.id);
  ticket.stage = STAGES.DENIED;
  ticket.deniedBy = staffMember.id;
  ticket.denyReason = reason;
  store.setTicket(channelId, ticket);

  await syncTicketChannelName(channel, ticket, config);

  await channel.send({
    content: `<@${ticket.userId}>`,
    ...buildDeniedEmbed(guild.id, config.tickets.deniedMessage, reason),
  });

  if (isPaymentCategory(ticket.category)) {
    applyPurchaseCooldown(guild.id, ticket.userId, 'denied');
  }

  await ticketLog.logTicketDenied(guild, ticket, channelId, staffMember, reason);
  return { ok: true };
}

async function closeTicket(channel, closedBy) {
  const ticket = store.getTicket(channel.id);
  const config = store.getGuild(channel.guild.id);

  if (ticket) {
    ticket.stage = STAGES.CLOSED;
    store.setTicket(channel.id, ticket);
  }

  await channel.send(buildClosedEmbed(channel.guild.id, config.tickets.closedMessage));

  if (ticket && isPaymentCategory(ticket.category)) {
    applyPurchaseCooldown(channel.guild.id, ticket.userId, 'closed');
  }

  const transcript = await buildTicketTranscript(channel);
  await ticketLog.logTicketClosed(channel.guild, ticket, channel, closedBy, transcript);

  setTimeout(() => {
    store.deleteTicket(channel.id);
    channel.delete('Ticket closed').catch(() => null);
  }, 5000);

  return { ok: true };
}

function formatTranscriptMessage(message) {
  const createdAt = message.createdAt?.toISOString() || new Date(message.createdTimestamp).toISOString();
  const author = `${message.author?.tag || 'Unknown User'} (${message.author?.id || 'unknown'})`;
  const content = message.content?.trim() || '';
  const attachments = message.attachments.size
    ? `\nAttachments: ${message.attachments.map((attachment) => attachment.url).join(', ')}`
    : '';
  const embeds = message.embeds.length ? `\nEmbeds: ${message.embeds.length}` : '';

  return `[${createdAt}] ${author}\n${content || '[no text content]'}${attachments}${embeds}`;
}

async function buildTicketTranscript(channel) {
  const messages = [];
  let before;

  while (messages.length < 1000) {
    const batch = await channel.messages
      .fetch({ limit: 100, before })
      .catch(() => null);
    if (!batch?.size) break;

    messages.push(...batch.values());
    before = batch.last().id;
    if (batch.size < 100) break;
  }

  const newestLast = messages.reverse();
  const header = [
    `Ticket transcript: #${channel.name}`,
    `Channel ID: ${channel.id}`,
    `Guild: ${channel.guild.name} (${channel.guild.id})`,
    `Created: ${channel.createdAt?.toISOString() || 'unknown'}`,
    `Messages: ${newestLast.length}`,
    '',
    '---',
    '',
  ].join('\n');
  const body = newestLast.map(formatTranscriptMessage).join('\n\n---\n\n');
  const buffer = Buffer.from(`${header}${body || '[no messages found]'}\n`, 'utf8');
  const safeName = channel.name.replace(/[^a-z0-9-]/gi, '-').slice(0, 80) || 'ticket';

  return new AttachmentBuilder(buffer, {
    name: `${safeName}-${channel.id}-transcript.txt`,
  });
}

function getTicketStats(guildId) {
  const tickets = store.listTicketsForGuild(guildId).filter((t) => t.stage !== STAGES.CLOSED);
  const awaiting = tickets.filter((t) => t.stage === STAGES.AWAITING_APPROVAL);
  const open = tickets.filter((t) => t.stage !== STAGES.AWAITING_APPROVAL);
  const oldest = tickets.reduce(
    (acc, t) => (!acc || t.createdAt < acc.createdAt ? t : acc),
    null
  );

  return {
    totalOpen: tickets.length,
    awaitingApproval: awaiting.length,
    otherOpen: open.length,
    oldest,
    tickets,
  };
}

function touchTicketChannelActivity(channelId) {
  store.touchTicketActivity(channelId);
}

module.exports = {
  STAGES,
  isPaymentCategory,
  collectTicketViewers,
  buildTicketPermissionOverwrites,
  findActiveUserTicket,
  createTicket,
  selectPlan,
  selectPaymentMethod,
  markPaymentDone,
  handleProofMessage,
  handleDoneKeyword,
  approvePayment,
  denyPayment,
  closeTicket,
  getTicketStats,
  touchTicketChannelActivity,
};
