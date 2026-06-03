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
  const message = config.scanner?.statusMessage || 'No status message configured.';
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

async function publishStatusToChannel(guild) {
  const config = store.getGuild(guild.id);
  const channelId = config.channels?.statusChannelId;
  if (!channelId) return false;

  const channel =
    guild.channels.cache.get(channelId) ||
    (await guild.channels.fetch(channelId).catch(() => null));
  if (!channel?.isTextBased()) return false;

  const payload = buildStatusEmbed(guild.id);
  const existingId = config.scanner?.statusMessageId;

  if (existingId) {
    const msg = await channel.messages.fetch(existingId).catch(() => null);
    if (msg) {
      await msg.edit(payload).catch(() => null);
      return true;
    }
  }

  const msg = await channel.send(payload).catch(() => null);
  if (msg) {
    store.setPath(guild.id, 'scanner.statusMessageId', msg.id);
  }
  return Boolean(msg);
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
        .setDescription('Update scanner status and publish to the status channel (staff)')
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
        .setDescription('Publish status to the configured status channel (staff)')
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
      const scanner = {
        ...config.scanner,
        status: state,
        statusMessage: message,
        statusUpdatedAt: Date.now(),
        statusUpdatedBy: interaction.user.id,
      };
      store.setGuild(interaction.guild.id, { scanner });

      const published = await publishStatusToChannel(interaction.guild);
      return interaction.reply({
        content: published
          ? 'Scanner status updated and posted to the status channel.'
          : 'Scanner status saved, but the status channel is missing or not configured.',
        ephemeral: true,
      });
    }

    if (sub === 'post') {
      const published = await publishStatusToChannel(interaction.guild);
      if (!published) {
        return interaction.reply({
          content:
            'Could not post — set `channels.statusChannelId` via `/config channel key:status`.',
          ephemeral: true,
        });
      }
      return interaction.reply({
        content: 'Status embed published to the status channel.',
        ephemeral: true,
      });
    }
  },
};
