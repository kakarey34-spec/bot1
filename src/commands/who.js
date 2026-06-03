const { ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } = require('discord.js');
const { withLogoPayload } = require('../utils/brand');
const { virelloEmbed } = require('../utils/ticketUi');

const SITE_URL = 'https://virello-secure.pages.dev/';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('who')
    .setDescription('Learn what VIRELLO does'),
  async execute(interaction) {
    const embed = virelloEmbed(interaction.guild.id, {
      title: '◆ Who We Are',
      description:
        'VIRELLO is a Roblox executor scanner service built for users who want quick checks, clear results, and steady protection without noisy setup.',
      fields: [
        {
          name: 'What we focus on',
          value:
            'We help users scan and verify Roblox executor-related risk signals, manage access with license-based protection, and keep service updates moving through Discord.',
          inline: false,
        },
        {
          name: 'How we work',
          value:
            'Purchases, support, verification, and help all run through private Discord lanes so every user can keep their case organized with staff.',
          inline: false,
        },
        {
          name: 'Website',
          value: `[Visit VIRELLO Secure](${SITE_URL})`,
          inline: false,
        },
      ],
    });

    const row = new ActionRowBuilder().addComponents(
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
