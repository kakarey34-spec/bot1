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
    const summaries = {
      monthly:
        'A simple month-to-month option for users who want full access without a long commitment.',
      quarterly:
        'A balanced pick for steady users who want more time upfront and a better overall rate.',
      yearly:
        'The strongest value for long-term protection, updates, and uninterrupted scanner access.',
    };

    const embed = virelloEmbed(interaction.guild.id, {
      title: '◆ VIRELLO — License Plans',
      description:
        'Choose the access window that fits how you use VIRELLO. Every plan includes the same core scanner access and Discord-based support.',
      fields: listPlans().map((plan) => ({
        name: plan.label,
        value: planValue(summaries[plan.id] || plan.label, plan.price, plan.term),
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
