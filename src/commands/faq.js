const { SlashCommandBuilder } = require('discord.js');
const { withLogoPayload } = require('../utils/brand');
const { virelloEmbed } = require('../utils/ticketUi');
const { listPlans, SITE_URL } = require('../constants/plans');

const FAQ_TOPICS = {
  payments: {
    title: 'Payments',
    body: [
      'Open a **Purchase** panel → pick your **plan** → choose **PayPal**, **Ethereum**, **Litecoin**, or **Greek Paysafe**.',
      'Pay, then click **Payment sent** (or type `done`) and upload **proof** in your private lane.',
      'Staff verify manually — keep everything in your ticket channel.',
    ].join('\n'),
  },
  renew: {
    title: 'Renewing your license',
    body: [
      'Use `/mylicense` to see your expiry date.',
      'Before it ends, open the **Renewal** panel (same flow as purchase).',
      'If still active, new time is **added** to your current license.',
    ].join('\n'),
  },
  scanner: {
    title: 'Scanner issues',
    body: [
      'Check `/status view` first — maintenance or outages are posted there.',
      'For bugs or errors, open **Support** → **Scanner Problems** and include screenshots + error text.',
    ].join('\n'),
  },
  license: {
    title: 'License & access',
    body: [
      'After approval you get the **buyer role** and a license record.',
      'Use `/mylicense` anytime to check plan, expiry, and days left.',
      'When a license expires, buyer access is removed — renew via the **Renewal** panel.',
    ].join('\n'),
  },
  support: {
    title: 'Getting help',
    body: [
      '**Purchase / Renewal** — payment and access lanes.',
      '**Support** — general questions.',
      '**Scanner Problems** — detection and scanner errors.',
      'One open lane per person. Stay respectful — spam or abuse may lead to restrictions.',
    ].join('\n'),
  },
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('faq')
    .setDescription('VIRELLO frequently asked questions')
    .addStringOption((opt) =>
      opt
        .setName('topic')
        .setDescription('Pick a topic (leave empty for full FAQ)')
        .addChoices(
          { name: 'Payments', value: 'payments' },
          { name: 'Renewing', value: 'renew' },
          { name: 'Scanner', value: 'scanner' },
          { name: 'License & access', value: 'license' },
          { name: 'Support lanes', value: 'support' }
        )
    ),
  async execute(interaction) {
    const topic = interaction.options.getString('topic');
    const planLines = listPlans()
      .map((p) => `• **${p.label}** — ${p.price}${p.term}`)
      .join('\n');

    if (topic && FAQ_TOPICS[topic]) {
      const entry = FAQ_TOPICS[topic];
      const embed = virelloEmbed(interaction.guild.id, {
        title: `◆ FAQ — ${entry.title}`,
        description: entry.body,
      });
      return interaction.reply({ ...withLogoPayload([embed]), ephemeral: true });
    }

    const embed = virelloEmbed(interaction.guild.id, {
      title: '◆ VIRELLO — FAQ',
      description: `Website: ${SITE_URL}\nUse \`/faq topic:\` for a specific section.`,
      fields: [
        { name: 'Plans', value: planLines, inline: false },
        ...Object.values(FAQ_TOPICS).map((entry) => ({
          name: entry.title,
          value: entry.body.slice(0, 1024),
          inline: false,
        })),
      ],
    });

    return interaction.reply({ ...withLogoPayload([embed]), ephemeral: true });
  },
};
