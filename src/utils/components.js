const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const PAYMENT_IDS = {
  paypal: 'payment_paypal',
  ethereum: 'payment_ethereum',
  litecoin: 'payment_litecoin',
  greek_paysafe: 'payment_greek_paysafe',
};

const TICKET_IDS = {
  open: 'ticket_open',
  close: 'ticket_close',
  paymentDone: 'ticket_payment_done',
  approve: 'ticket_approve',
  deny: 'ticket_deny',
  claim: 'ticket_claim',
};

const PLAN_IDS = {
  monthly: 'plan_monthly',
  quarterly: 'plan_quarterly',
  yearly: 'plan_yearly',
};

const PLAN_KEY_MAP = {
  [PLAN_IDS.monthly]: 'monthly',
  [PLAN_IDS.quarterly]: 'quarterly',
  [PLAN_IDS.yearly]: 'yearly',
};

const PAYMENT_EMOJI = {
  paypal: '💳',
  ethereum: '💎',
  litecoin: '🪙',
  greek_paysafe: '🎫',
};

function planSelectionRow() {
  const { listPlans } = require('../constants/plans');
  const buttons = listPlans().map((plan) =>
    new ButtonBuilder()
      .setCustomId(PLAN_IDS[plan.id])
      .setLabel(plan.label)
      .setStyle(ButtonStyle.Secondary)
      .setEmoji(plan.emoji)
  );

  const rows = [];
  for (let i = 0; i < buttons.length; i += 5) {
    rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
  }
  return rows;
}

function paymentMethodRow(enabledMethods) {
  const buttons = enabledMethods.map(([key, method]) => {
    const btn = new ButtonBuilder()
      .setCustomId(PAYMENT_IDS[key] || `payment_${key}`)
      .setLabel(method.label || key)
      .setStyle(ButtonStyle.Primary);
    const emoji = PAYMENT_EMOJI[key];
    if (emoji) btn.setEmoji(emoji);
    return btn;
  });

  const rows = [];
  for (let i = 0; i < buttons.length; i += 5) {
    rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
  }
  return rows;
}

function paymentDoneRow() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(TICKET_IDS.paymentDone)
        .setLabel('Payment sent')
        .setEmoji('✅')
        .setStyle(ButtonStyle.Success)
    ),
  ];
}

function staffApprovalRow(ticketChannelId, ticket = null) {
  const buttons = [];

  if (ticket?.claimedBy) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(`${TICKET_IDS.claim}:${ticketChannelId}`)
        .setLabel('Claimed')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true)
    );
  } else {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(`${TICKET_IDS.claim}:${ticketChannelId}`)
        .setLabel('Claim')
        .setEmoji('🙋')
        .setStyle(ButtonStyle.Primary)
    );
  }

  buttons.push(
    new ButtonBuilder()
      .setCustomId(`${TICKET_IDS.approve}:${ticketChannelId}`)
      .setLabel('Approve')
      .setEmoji('✔️')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`${TICKET_IDS.deny}:${ticketChannelId}`)
      .setLabel('Decline')
      .setEmoji('✖️')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(TICKET_IDS.close)
      .setLabel('Close lane')
      .setEmoji('🔒')
      .setStyle(ButtonStyle.Secondary)
  );

  return [new ActionRowBuilder().addComponents(buttons)];
}

module.exports = {
  PAYMENT_IDS,
  TICKET_IDS,
  PLAN_IDS,
  PLAN_KEY_MAP,
  planSelectionRow,
  paymentMethodRow,
  paymentDoneRow,
  staffApprovalRow,
};
