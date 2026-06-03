const { SlashCommandBuilder } = require('discord.js');
const store = require('../config/store');
const { LEVELS, canUse, denyInteraction } = require('../utils/permissions');
const { withLogoPayload } = require('../utils/brand');
const { virelloEmbed } = require('../utils/ticketUi');

const STATUS_META = {
  operational: { label: 'Operational', color: 0x57f287, emoji: '🟢' },
  degraded: { label: 'Degraded', color: 0xfaa61a, emoji: '🟡' },
  maintenance: { label: 'Maintenance', color: 0xed4245, emoji: '🔴' },
};

function buildStatusEmbed(guildId) {
  const config = store.getGuild(guildId);
  const state = config.scanner?.status || 'operational';
  const meta = STATUS_META[state] || STATUS_META.operational;
  const message =
    config.scanner?.statusMessage || 'No status message configured.';
  const updatedAt = config.scanner?.statusUpdatedAt;

  const embed = virelloEmbed(guildId, {
    title: `${meta.emoji} Scanner status — ${meta.label}`,
    description: message,
  }).setColor(meta.color);

  if (updatedAt) {
    embed.setFooter({
      text: `Updated <t:${Math.floor(updatedAt / 1000)}:R>`,
    });
  }

  return withLogoPayload([embed]);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('status')
    .setDescription('View or update VIRELLO scanner status')
    .addSubcommand((sub) =>
      sub.setName('view').setDescription('View current scanner status (read-only)')
    )
    .addSubcommand((sub) =>
      sub
        .setName('set')
        .setDescription('Post or update the scanner status embed (staff)')
        .addStringOption((opt) =>
          opt
            .setName('state')
            .setDescription('Overall scanner state')
            .setRequired(true)
            .addChoices(
              { name: 'Operational', value: 'operational' },
              { name: 'Degraded', value: 'degraded' },
              { name: 'Maintenance', value: 'maintenance' }
            )
        )
        .addStringOption((opt) =>
          opt
            .setName('message')
            .setDescription('Public status message')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('post')
        .setDescription('Post the current status embed in this channel (staff)')
    ),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'view') {
      return interaction.reply({
        ...buildStatusEmbed(interaction.guild.id),
        ephemeral: true,
      });
    }

    if (!canUse(interaction.member, LEVELS.staff)) {
      return denyInteraction(interaction, 'staff');
    }

    if (sub === 'set') {
      const state = interaction.options.getString('state');
      const message = interaction.options.getString('message');
      const config = store.getGuild(interaction.guild.id);
      config.scanner = {
        status: state,
        statusMessage: message,
        statusUpdatedAt: Date.now(),
        statusUpdatedBy: interaction.user.id,
      };
      store.setGuild(interaction.guild.id, { scanner: config.scanner });

      return interaction.reply({
        content: 'Scanner status updated. Use `/status post` to publish in a channel.',
        ephemeral: true,
      });
    }

    if (sub === 'post') {
      await interaction.channel.send(buildStatusEmbed(interaction.guild.id));
      return interaction.reply({
        content: 'Status embed posted in this channel.',
        ephemeral: true,
      });
    }
  },
};
