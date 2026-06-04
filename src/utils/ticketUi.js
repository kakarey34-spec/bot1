const { EmbedBuilder } = require('discord.js');
const { BRAND, brandFooter, withLogoPayload } = require('./brand');

function virelloEmbed(guildId, options = {}) {
  const embed = new EmbedBuilder()
    .setColor(BRAND.red)
    .setTimestamp();

  if (options.title) embed.setTitle(options.title);
  if (options.description) embed.setDescription(options.description);
  if (options.author) embed.setAuthor(options.author);
  if (options.fields?.length) embed.addFields(options.fields);
  if (options.footer !== false) embed.setFooter(brandFooter(guildId));

  return embed;
}

function buildPurchasePanelEmbed(guildId) {
  const embed = virelloEmbed(guildId, {
    title: '◆ VIRELLO — Purchase Desk',
    description:
      'Secure a private lane with our team to complete your order, verify payment, and receive access.',
  }).addFields(
    {
      name: 'How it works',
      value:
        '① Open your purchase lane below\n② Choose a payment method\n③ Send proof when prompted\n④ Staff confirms and grants access',
      inline: false,
    },
    {
      name: 'Before you open',
      value:
        '• Have your Discord username ready for payment notes\n• Only open **one** lane at a time\n• Misuse of the desk may result in restrictions',
      inline: false,
    },
    {
      name: 'Staff availability',
      value:
        'Staff will respond **whenever a team member is available**. Keep all updates in your private lane.',
      inline: false,
    }
  );

  return withLogoPayload([embed]);
}

function buildSupportPanelEmbed(guildId) {
  const embed = virelloEmbed(guildId, {
    title: '◆ VIRELLO — Help Center',
    description:
      'Pick the lane that fits your issue. Each opens a **private channel** only you and staff can see.',
  }).addFields(
    {
      name: '💬 General Support',
      value:
        'Account questions, product help, and anything that is not scanner-related.\n**Include:** what you tried and what you expected.',
      inline: false,
    },
    {
      name: '🔍 Scanner Problems',
      value:
        'Detection errors, false flags, crashes, or hardware/software scanner issues.\n**Include:** scanner name, error text, and screenshots if possible.',
      inline: false,
    },
    {
      name: 'Support guidelines',
      value:
        '• Check FAQ channels first\n• One open lane per person\n• Stay respectful — spam or abuse leads to action',
      inline: false,
    },
    {
      name: 'Staff availability',
      value:
        'Staff will reply **whenever a team member is available**. Please be patient and avoid opening duplicate lanes.',
      inline: false,
    }
  );

  return withLogoPayload([embed]);
}

function buildTicketWelcome(guildId, category, member) {
  const user = member.toString();
  const cat = category || { id: 'support', label: 'Support' };
  const waitNote =
    'Staff will respond **whenever a team member is available**. Keep all messages in this lane.';

  if (cat.id === 'payments') {
    const embed = virelloEmbed(guildId, {
      title: '◆ Purchase lane opened',
      description: `${user} — you're in a **private** purchase channel. Only you and VIRELLO staff can see this.`,
    }).addFields(
      {
        name: 'Next step',
        value: 'Choose your **license plan** using the buttons below, then select a payment method.',
        inline: false,
      },
      {
        name: 'Promo code',
        value: 'After you pick a payment method, click **Apply promo code** (or `/promo apply code:YOURCODE`).',
        inline: false,
      },
      {
        name: 'After paying',
        value: 'Press **Payment sent** or type `done`, then upload your proof (screenshot or transaction ID).',
        inline: false,
      },
      {
        name: 'Staff availability',
        value: waitNote,
        inline: false,
      }
    );
    return { content: null, ...withLogoPayload([embed]) };
  }

  if (cat.id === 'scanner') {
    const embed = virelloEmbed(guildId, {
      title: '◆ Scanner support lane',
      description: `${user} — tell us what went wrong and we'll troubleshoot with you here.`,
    }).addFields(
      {
        name: 'What to send',
        value:
          '• Scanner / tool name and version\n• Exact error message or behavior\n• Screenshots or short clips if you have them',
        inline: false,
      },
      {
        name: 'Staff availability',
        value: waitNote,
        inline: false,
      }
    );
    return { content: null, ...withLogoPayload([embed]) };
  }

  const embed = virelloEmbed(guildId, {
    title: '◆ Support lane opened',
    description: `${user} — you're connected to **VIRELLO Support**. This channel is private to you and staff.`,
  }).addFields(
    {
      name: 'What to include',
      value:
        '• A clear summary of your question\n• Steps you already tried\n• Any relevant IDs, links, or screenshots',
      inline: false,
    },
    {
      name: 'Staff availability',
      value: waitNote,
      inline: false,
    }
  );
  return { content: null, ...withLogoPayload([embed]) };
}

function buildPaymentMethodEmbed(guildId, method, methodKey, { plan, promo, pricing, amountLines } = {}) {
  const embed = virelloEmbed(guildId, {
    title: `◆ ${method.label || methodKey}`,
    description: method.details || '_Payment details not configured — contact an administrator._',
  });

  if (amountLines) {
    embed.addFields({
      name: 'Your total',
      value: amountLines,
      inline: false,
    });
  } else if (plan) {
    embed.addFields({
      name: 'Amount to send',
      value: `**${plan.price}**${plan.term}`,
      inline: false,
    });
  }

  embed.addFields({
    name: 'When finished',
    value:
      'Use **Apply promo code** if you have one, then click **Payment sent** (or type `done`) and upload proof.',
    inline: false,
  });

  return withLogoPayload([embed]);
}

function buildProofRequestEmbed(guildId, message) {
  const embed = virelloEmbed(guildId, {
    title: '◆ Upload payment proof',
    description: message,
  }).addFields({
    name: 'Accepted proof',
    value: 'Screenshot of payment, receipt, or transaction ID in a single message.',
    inline: false,
  });

  return withLogoPayload([embed]);
}

function buildProofReceivedEmbed(guildId, message) {
  const embed = virelloEmbed(guildId, {
    title: '◆ Proof received',
    description: message,
  });

  return withLogoPayload([embed]);
}

function buildStaffReviewEmbed(guildId, ticket, proofUrl) {
  const { formatPlanLabel } = require('../constants/plans');
  const fields = [
    { name: 'Buyer', value: `<@${ticket.userId}>`, inline: true },
    { name: 'Plan', value: formatPlanLabel(ticket.planId), inline: true },
    { name: 'Method', value: `\`${ticket.paymentMethod || 'unknown'}\``, inline: true },
    { name: 'Proof', value: `[View message](${proofUrl})`, inline: true },
  ];

  if (ticket.promoCode) {
    fields.push({
      name: 'Promo',
      value: `\`${ticket.promoCode}\`${ticket.amountDue != null ? ` — due **$${Number(ticket.amountDue).toFixed(2)}**` : ''}`,
      inline: true,
    });
  } else if (ticket.amountDue != null) {
    fields.push({
      name: 'Amount due',
      value: `**$${Number(ticket.amountDue).toFixed(2)}**`,
      inline: true,
    });
  }

  if (ticket.claimedBy) {
    fields.push({
      name: 'Claimed by',
      value: `<@${ticket.claimedBy}>`,
      inline: true,
    });
  }

  const embed = virelloEmbed(guildId, {
    title: '◆ Payment awaiting review',
    description: ticket.claimedBy
      ? 'A staff member is handling this review.'
      : 'A purchase is ready for staff verification. **Claim** before approving.',
    fields,
  });

  return withLogoPayload([embed]);
}

function buildApprovedEmbed(guildId, message) {
  const embed = virelloEmbed(guildId, {
    title: '◆ Payment approved',
    description: message,
  });

  return withLogoPayload([embed]);
}

function buildDeniedEmbed(guildId, message, reason = null) {
  const fields = [];
  if (reason) {
    fields.push({ name: 'Reason', value: reason.slice(0, 1000), inline: false });
  }
  const embed = virelloEmbed(guildId, {
    title: '◆ Payment not approved',
    description: message,
    fields: fields.length ? fields : undefined,
  });

  return withLogoPayload([embed]);
}

function buildClosedEmbed(guildId, message) {
  const embed = virelloEmbed(guildId, {
    title: '◆ Lane closed',
    description: message,
  });

  return withLogoPayload([embed]);
}

module.exports = {
  buildPurchasePanelEmbed,
  buildSupportPanelEmbed,
  buildTicketWelcome,
  buildPaymentMethodEmbed,
  buildProofRequestEmbed,
  buildProofReceivedEmbed,
  buildStaffReviewEmbed,
  buildApprovedEmbed,
  buildDeniedEmbed,
  buildClosedEmbed,
  virelloEmbed,
};
