/** Owner-posted legal & policy document content for VIRELLO. Edit text here as needed. */

const STAFF_AVAILABILITY =
  'Staff will respond **whenever a team member is available**. There is no fixed schedule — please be patient and keep all messages in your lane.';

module.exports = {
  STAFF_AVAILABILITY,

  rules: {
    title: '◆ VIRELLO — Server Rules',
    description:
      'By being in this server you agree to follow these rules. Staff may warn, restrict, or remove members who break them.',
    fields: [
      {
        name: '1 · Respect',
        value:
          'Treat members and staff with respect. No harassment, hate speech, threats, or targeted abuse.',
        inline: false,
      },
      {
        name: '2 · No spam or abuse',
        value:
          'Do not spam channels, abuse pings, flood tickets, or use bots/scripts to disrupt the server.',
        inline: false,
      },
      {
        name: '3 · Tickets & support',
        value:
          'Open **one lane at a time**. Use the correct panel (Purchase vs Support). False or troll tickets may lead to a ban.',
        inline: false,
      },
      {
        name: '4 · Payments & chargebacks',
        value:
          'Do not initiate chargebacks or payment disputes without contacting staff first. Fraudulent disputes may result in a permanent ban.',
        inline: false,
      },
      {
        name: '5 · Sharing & security',
        value:
          'Do not share purchased access, leaks, or private staff information. Keep your account and payment details secure.',
        inline: false,
      },
      {
        name: '6 · Staff decisions',
        value:
          'Staff decisions are final. If you believe a mistake was made, open a **Support** lane and explain calmly.',
        inline: false,
      },
    ],
    footer: 'VIRELLO · Last updated when posted by server owner',
  },

  terms: {
    title: '◆ VIRELLO — Terms & Conditions',
    description:
      'These Terms & Conditions govern your use of the VIRELLO Discord server, bot, products, and related services. By accessing or using our services, you agree to these Terms.',
    fields: [
      {
        name: 'Service',
        value:
          'VIRELLO provides digital products, subscriptions, tools, and support through Discord. Features, pricing, availability, and service offerings may be modified, suspended, or discontinued at any time without prior notice.',
        inline: false,
      },
      {
        name: 'Eligibility',
        value:
          'You must comply with Discord\'s Terms of Service and Community Guidelines and be legally capable of entering into this agreement in your jurisdiction.',
        inline: false,
      },
      {
        name: 'Accounts & Access',
        value:
          'Access to products and services is tied to your Discord account and any roles assigned after a verified purchase.\n\nSharing, transferring, reselling, or granting access to others is prohibited unless explicitly authorized by VIRELLO staff.',
        inline: false,
      },
      {
        name: 'Payments',
        value:
          'All payments must be completed using the methods provided in the Purchase Panel or Purchase Lane.\n\nPayments are manually reviewed and verified by staff before access is granted.',
        inline: false,
      },
      {
        name: 'Subscriptions & Cancellation',
        value:
          'Certain services may be provided on a monthly subscription basis.\n\nYou may cancel your subscription at any time to prevent future billing. Cancellation does not entitle you to a refund for the current billing period.',
        inline: false,
      },
      {
        name: 'Refund Policy',
        value:
          'All sales are final.\n\nDue to the nature of digital goods and services, refunds, partial refunds, and prorated refunds are not provided once access has been delivered, except where required by applicable law or in cases of verified billing errors at staff discretion.',
        inline: false,
      },
      {
        name: 'Chargebacks & Disputes',
        value:
          'Users must contact staff before initiating a payment dispute or chargeback.\n\nUnauthorized chargebacks or payment reversals may result in:\n• Immediate termination of access\n• Permanent removal from VIRELLO services\n• Restriction from future purchases',
        inline: false,
      },
      {
        name: 'Limitation of Liability',
        value:
          'VIRELLO services are provided "as is" and "as available" without warranties of any kind.\n\nTo the fullest extent permitted by law, VIRELLO shall not be liable for any indirect, incidental, consequential, special, or punitive damages arising from the use of our services.',
        inline: false,
      },
      {
        name: 'Termination',
        value:
          'We reserve the right to suspend or terminate access to our services at any time for violations of these Terms, abuse of our systems, fraudulent activity, or any behavior deemed harmful to the community or service.',
        inline: false,
      },
      {
        name: 'Changes to These Terms',
        value:
          'We may update these Terms at any time.\n\nContinued use of VIRELLO services after changes are posted constitutes acceptance of the revised Terms.',
        inline: false,
      },
    ],
    footer: 'VIRELLO · Terms & Conditions',
  },

  buyerterms: {
    title: '🛒 Purchase Terms',
    description:
      'Please read before opening a Purchase Lane.',
    fields: [
      {
        name: '📌 Before You Buy',
        value:
          '• Make sure you\'re purchasing the correct product/service.\n• Use only the payment method provided in your lane.\n• Include your Discord username in the payment notes if requested.',
        inline: false,
      },
      {
        name: '💳 Payment Verification',
        value:
          'After sending payment:\n• Click **Payment Sent** or type **done**.\n• Upload proof of payment (screenshot or transaction ID).\n\nAll payments are reviewed manually. Access will only be granted after staff approval.',
        inline: false,
      },
      {
        name: '⏳ Response Times',
        value:
          'Staff respond whenever a team member is available. There is no fixed schedule, so please be patient and keep all communication in your lane.',
        inline: false,
      },
      {
        name: '🚫 One Purchase Lane Per Person',
        value:
          'You may only have **one active Purchase Lane** at a time. Please resolve or close existing lanes before opening another.',
        inline: false,
      },
      {
        name: '🔄 Monthly Service',
        value:
          'This is a monthly service. You may cancel at any time to stop future payments.\n\n**All sales are final. Refunds are not available under any circumstances, including partial usage, inactivity, or remaining subscription time.**',
        inline: false,
      },
      {
        name: '⚠️ Chargebacks & Disputes',
        value:
          'If you have an issue with your order, contact staff first.\n\nOpening a chargeback, payment dispute, or unauthorized payment reversal may result in:\n• Permanent ban from the server\n• Immediate loss of access to all products/services\n• Restriction from future purchases',
        inline: false,
      },
      {
        name: '📦 Delivery',
        value:
          'Roles, products, access, or instructions will be delivered through Discord after payment has been verified and approved.\n\nKeep this lane open until your order is complete.',
        inline: false,
      },
      {
        name: '🛠️ Support After Purchase',
        value:
          'Need help after your purchase?\n\nUse the **Support Panel** instead of opening another Purchase Lane, unless you\'re placing a new order.',
        inline: false,
      },
    ],
    footer: 'VIRELLO · Buyer Terms',
  },

  privacypolicy: {
    title: '◆ VIRELLO — Privacy Policy',
    description:
      'This Privacy Policy explains what information VIRELLO collects through its Discord server, bot, and related services, and how that information is used.',
    fields: [
      {
        name: 'Information We Collect',
        value:
          'We may collect:\n• Discord User ID\n• Discord username and avatar\n• Messages and files submitted in ticket lanes\n• Payment proof provided for verification (screenshots or transaction references)\n• Server roles, access permissions, and whitelist information\n• Basic diagnostic or service-related information required for operation',
        inline: false,
      },
      {
        name: 'Information We Do Not Collect',
        value:
          'VIRELLO does not intentionally collect, request, store, or process sensitive personal information, including:\n• Passwords\n• Authentication codes\n• Two-factor authentication backups\n• Banking credentials\n• Credit card information\n• Personal government identification documents\n\nIf such information is accidentally shared, users should notify staff immediately so appropriate action can be taken.',
        inline: false,
      },
      {
        name: 'How We Use Information',
        value:
          'Information may be used to:\n• Operate ticket systems\n• Verify purchases and payments\n• Grant product access\n• Provide customer support\n• Enforce server rules and policies\n• Investigate disputes or abuse\n• Improve our services',
        inline: false,
      },
      {
        name: 'Storage',
        value:
          'Guild settings, ticket data, and service-related information may be stored on systems used to operate the VIRELLO bot and services.\n\nPayment verification materials remain within Discord channels according to server retention practices.',
        inline: false,
      },
      {
        name: 'Data Sharing',
        value:
          'We do not sell user data.\n\nInformation may be accessible to authorized VIRELLO staff members who require access to perform support, moderation, payment verification, or service administration duties.\n\nInformation may also be disclosed if required by law or legal process.',
        inline: false,
      },
      {
        name: 'Discord Services',
        value:
          'Your use of Discord is also governed by Discord\'s Privacy Policy and Terms of Service.\n\nVIRELLO does not control Discord\'s collection, storage, or processing of data.',
        inline: false,
      },
      {
        name: 'Data Retention',
        value:
          'Ticket data may be deleted after tickets are closed.\n\nModeration logs, backups, payment verification records, and other service-related records may be retained for operational, security, fraud-prevention, and dispute-resolution purposes.',
        inline: false,
      },
      {
        name: 'Your Rights',
        value:
          'You may request information regarding data we hold about you by contacting server staff.\n\nYou may also leave the server at any time, though certain records may be retained where necessary for legitimate business, security, or legal purposes.',
        inline: false,
      },
      {
        name: 'Contact',
        value:
          'For privacy questions, open a **Support** lane or contact the server owner directly.',
        inline: false,
      },
    ],
    footer: 'VIRELLO · Privacy Policy',
  },
};
