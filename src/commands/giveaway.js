const { SlashCommandBuilder, ChannelType } = require('discord.js');
const { LEVELS } = require('../utils/permissions');
const { parseDuration } = require('../utils/parseDuration');
const store = require('../config/store');
const {
  startGiveaway,
  endGiveaway,
  rerollGiveaway,
  MAX_WINNERS,
} = require('../services/giveawayService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Create and manage giveaways')
    .addSubcommand((sub) =>
      sub
        .setName('start')
        .setDescription('Start a new giveaway')
        .addStringOption((opt) =>
          opt.setName('title').setDescription('Giveaway title').setRequired(true).setMaxLength(100)
        )
        .addStringOption((opt) =>
          opt.setName('prize').setDescription('What winners receive').setRequired(true).setMaxLength(200)
        )
        .addStringOption((opt) =>
          opt
            .setName('duration')
            .setDescription('How long it runs (e.g. 30m, 1h, 2d, 1w)')
            .setRequired(true)
        )
        .addIntegerOption((opt) =>
          opt
            .setName('winners')
            .setDescription('Number of winners (default 1)')
            .setMinValue(1)
            .setMaxValue(MAX_WINNERS)
        )
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('Channel for the giveaway post (default: here)')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        )
        .addStringOption((opt) =>
          opt
            .setName('description')
            .setDescription('Extra details shown on the embed')
            .setMaxLength(500)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('end')
        .setDescription('End a giveaway early and pick winners')
        .addStringOption((opt) =>
          opt
            .setName('message_id')
            .setDescription('ID of the giveaway message (right-click → Copy Message ID)')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName('list').setDescription('List active giveaways in this server')
    )
    .addSubcommand((sub) =>
      sub
        .setName('reroll')
        .setDescription('Replace an invalid winner with a new random entrant')
        .addStringOption((opt) =>
          opt
            .setName('message_id')
            .setDescription('Giveaway message ID')
            .setRequired(true)
        )
        .addUserOption((opt) =>
          opt
            .setName('user')
            .setDescription('Winner to replace')
            .setRequired(true)
        )
    ),
  permissionLevel: LEVELS.admin,
  permissionLabel: 'admin',
  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'start') {
      const durationRaw = interaction.options.getString('duration');
      const durationMs = parseDuration(durationRaw);
      if (!durationMs) {
        return interaction.reply({
          content: 'Invalid duration. Use formats like `30m`, `1h`, `2d`, or `1w`.',
          ephemeral: true,
        });
      }

      await interaction.deferReply({ ephemeral: true });

      const result = await startGiveaway(interaction, {
        title: interaction.options.getString('title'),
        prize: interaction.options.getString('prize'),
        description: interaction.options.getString('description'),
        durationMs,
        winnerCount: interaction.options.getInteger('winners') ?? 1,
        channel: interaction.options.getChannel('channel') || interaction.channel,
      });

      if (result.error) {
        return interaction.editReply({ content: result.error });
      }

      return interaction.editReply({
        content: `Giveaway started in ${result.message.channel} — ends in **${result.endsIn}**. Message ID: \`${result.message.id}\``,
      });
    }

    if (sub === 'end') {
      const messageId = interaction.options.getString('message_id').trim();
      await interaction.deferReply({ ephemeral: true });

      const giveaway = store.getGiveaway(messageId);
      if (!giveaway || giveaway.guildId !== interaction.guild.id) {
        return interaction.editReply({
          content: 'No active giveaway found for that message ID in this server.',
        });
      }

      const result = await endGiveaway(client, messageId, {
        force: true,
        endedBy: interaction.user.id,
      });

      if (result.error) {
        return interaction.editReply({ content: result.error });
      }

      const winners =
        result.winnerIds?.length > 0
          ? result.winnerIds.map((id) => `<@${id}>`).join(', ')
          : '_none (no entries)_';

      return interaction.editReply({
        content: `Giveaway ended. Winner(s): ${winners}`,
      });
    }

    if (sub === 'reroll') {
      const messageId = interaction.options.getString('message_id').trim();
      const user = interaction.options.getUser('user');
      await interaction.deferReply({ ephemeral: true });

      const result = await rerollGiveaway(client, messageId, user.id);
      if (result.error) {
        return interaction.editReply({ content: result.error });
      }

      return interaction.editReply({
        content: `Rerolled: <@${result.replaced}> → <@${result.newWinner}>. Announcement posted in the giveaway channel.`,
      });
    }

    if (sub === 'list') {
      const active = store.listActiveGiveaways().filter((g) => g.guildId === interaction.guild.id);
      if (!active.length) {
        return interaction.reply({ content: 'No active giveaways in this server.', ephemeral: true });
      }

      const lines = active.map((g) => {
        const ends = Math.floor(g.endsAt / 1000);
        return `• **${g.title}** — ${g.prize} — <#${g.channelId}> — ends <t:${ends}:R> — ID \`${g.messageId}\``;
      });

      return interaction.reply({
        content: `**Active giveaways (${active.length})**\n${lines.join('\n')}`,
        ephemeral: true,
      });
    }
  },
};
