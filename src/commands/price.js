const { ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } = require('discord.js');
const { withLogoPayload } = require('../utils/brand');
const { LEVELS } = require('../utils/permissions');
const { virelloEmbed } = require('../utils/ticketUi');

const { listPlans, SITE_URL } = require('../constants/plans');

const PLAN_FEATURES = [
  'Private license activation',
  'Executor scan access',
  'Unlimited PIN requests',
  'Ongoing scanner updates',
  'Discord ticket assistance',
];

function planValue(summary, price, term) {
  return [
    summary,
    '',
    `**${price}** ${term}`,
    PLAN_FEATURES.map((feature) => `• ${feature}`).join('\n'),
  ].join('\n');
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('price')
    .setDescription('View VIRELLO license plans'),
  permissionLevel: LEVELS.staff,
  permissionLabel: 'staff',
  async execute(interaction) {
    const embed = virelloEmbed(interaction.guild.id, {
      title: '◆ VIRELLO — License Plans',
      description:
        'Personal and enterprise tiers. Pay with card on the website or open a ticket here for PayPal, Greek Paysafe, Litecoin, or Ethereum.',
      fields: listPlans().map((plan) => ({
        name: `${plan.label}${plan.slots > 1 ? ` · ${plan.slots} seats` : ''}`,
        value: planValue(plan.blurb || plan.label, plan.price, plan.term),
        inline: false,
      })),
    });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('Purchase')
        .setStyle(ButtonStyle.Link)
        .setURL(SITE_URL),
      new ButtonBuilder()
        .setLabel('Open Website')
        .setStyle(ButtonStyle.Link)
        .setURL(SITE_URL)
    );

    return interaction.reply({
      ...withLogoPayload([embed]),
      components: [row],
    });
  },
};
