/** Default guild configuration — merged with persisted data on load. */
module.exports = {
  prefix: '!',
  tickets: {
    categoryId: null,
    supportRoleIds: [],
    viewerRoleIds: [],
    viewerUserIds: [],
    approvalChannelPrefix: 'waiting-manual-approval',
    logChannelId: null,
    panelChannelId: null,
    welcomeMessage:
      'Welcome {user}! Please select a payment method below to continue your purchase.',
    awaitingProofMessage:
      'Upload your payment proof in this channel — screenshot, receipt, or transaction ID in one message.',
    waitingApprovalMessage:
      'Your proof is in review. Staff will verify and approve your purchase shortly — hang tight.',
    approvedMessage:
      '**Access granted.** Your payment was verified. Welcome to VIRELLO — enjoy your purchase.',
    deniedMessage:
      'We could not verify this payment. Reply here with more details or contact staff if you believe this is a mistake.',
    closedMessage: 'This lane has been closed. Open a new one from the panel if you still need help.',
    openCooldownMinutes: 5,
    inactiveCloseHours: 48,
    categoryLogChannels: {
      support: '1511637386080161792',
      scanner: '1511840050298622083',
      payments: '1511637484185063475',
    },
    panels: null,
    categoryWelcomeMessages: {
      support:
        'Welcome {user}! Please describe your question or issue and staff will assist you shortly.',
      scanner:
        'Welcome {user}! Please describe your scanner problem, including any error messages or screenshots.',
      payments:
        'Welcome {user}! Please select a payment method below to continue your purchase.',
    },
  },
  payments: {
    paypal: {
      label: 'PayPal',
      enabled: true,
      details: 'Send payment to: your-paypal@email.com\nInclude your Discord username in the note.',
    },
    ethereum: {
      label: 'Ethereum',
      enabled: true,
      details: 'ETH Address: 0xYourEthereumAddressHere',
    },
    litecoin: {
      label: 'Litecoin',
      enabled: true,
      details: 'LTC Address: YourLitecoinAddressHere',
    },
    greek_paysafe: {
      label: 'Greek Paysafe',
      enabled: true,
      details: 'Paysafe instructions: contact staff or follow your configured Paysafe details here.',
    },
  },
  roles: {
    autoRoleId: '1511486871153152120',
    purchaserRoleId: '1510614274299531334',
    staffRoleIds: [],
    muteRoleId: null,
  },
  whitelist: {
    userIds: [],
    adminRoleIds: [],
    staffRoleIds: [],
    configRoleIds: [],
  },
  moderation: {
    muteDurationMinutes: 10,
  },
  channels: {
    repChannelId: '1511488413327691816',
    buyerRegistryChannelId: '1511637354887122955',
    statusChannelId: '1511840270810087474',
  },
  license: {
    siteUrl: 'https://virello-secure.pages.dev/',
    welcomeDm:
      '**Access granted.** Your VIRELLO license is active.\n\n**Plan:** {plan}\n**Valid until:** {expires}\n\nSite: {site}\nUse `/mylicense` to check status anytime.',
    expiryWarningDays: [7, 3, 1],
  },
  scanner: {
    status: 'operational',
    statusMessage: 'All scanner systems are operational.',
    statusUpdatedAt: null,
    statusUpdatedBy: null,
  },
  onJoin: {
    welcomeDmEnabled: true,
    welcomeDm:
      'Welcome to **VIRELLO**, {user}! Browse the server, read the rules, and use the **Purchase** panel when you\'re ready to buy.\n\nWebsite: {site}',
  },
  embeds: {
    color: 0xd40000,
    footer: 'VIRELLO',
  },
};
