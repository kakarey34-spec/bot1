const { EmbedBuilder, SlashCommandBuilder, ChannelType } = require('discord.js');
const {
  buildTicketPanelPayload,
  buildTicketPanelRows,
  PANEL_TYPES,
} = require('../utils/ticketPanel');
const { LEVELS } = require('../utils/permissions');
const store = require('../config/store');
const ticketManager = require('../services/ticketManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Manage support and purchase tickets')
    .addSubcommand((sub) =>
      sub
        .setName('panel')
        .setDescription('Post a purchase or support ticket panel in this channel')
        .addStringOption((opt) =>
          opt
            .setName('type')
            .setDescription('Which panel to post')
            .setRequired(true)
            .addChoices(
              { name: 'Purchase (payments)', value: PANEL_TYPES.purchase },
              { name: 'Support (help & scanner)', value: PANEL_TYPES.support },
              { name: 'Renewal (license extension)', value: PANEL_TYPES.renewal }
            )
        )
    )
    .addSubcommand((sub) =>
      sub.setName('list').setDescription('List open tickets in this server (staff)')
    )
    .addSubcommand((sub) =>
      sub.setName('stats').setDescription('Ticket queue summary (staff)')
    )
    .addSubcommand((sub) =>
      sub.setName('close').setDescription('Close the ticket channel you are in')
    )
    .addSubcommand((sub) =>
      sub
        .setName('approve')
        .setDescription('Approve payment for a ticket and grant the purchaser role')
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('Ticket channel (defaults to current channel)')
            .addChannelTypes(ChannelType.GuildText)
        )
    ),
  permissionLevel: LEVELS.everyone,
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'panel') {
      const { canUse, denyInteraction } = require('../utils/permissions');
      if (!canUse(interaction.member, LEVELS.admin)) {
        return denyInteraction(interaction, 'admin');
      }

      const panelType = interaction.options.getString('type');
      const panelLabels = {
        [PANEL_TYPES.purchase]: 'Purchase',
        [PANEL_TYPES.support]: 'Support',
        [PANEL_TYPES.renewal]: 'Renewal',
      };
      const panelLabel = panelLabels[panelType] || panelType;

      await interaction.deferReply({ ephemeral: true });

      try {
        const panelPayload = buildTicketPanelPayload(interaction.guild.id, panelType);
        await interaction.channel.send({
          ...panelPayload,
          components: buildTicketPanelRows(interaction.guild.id, panelType),
        });
      } catch (err) {
        console.error(`/ticket panel ${panelType} error:`, err);
        const hint =
          err.code === 50013
            ? 'I need **Send Messages** and **Embed Links** in this channel.'
            : err.message?.includes('emoji') || err.message?.includes('Emoji')
              ? 'A panel button emoji was rejected by Discord.'
              : err.message || 'Could not post the panel.';
        return interaction.editReply({ content: `Failed to post panel: ${hint}` });
      }

      return interaction.editReply({
        content: `**${panelLabel}** ticket panel posted in this channel.`,
      });
    }

    if (sub === 'close') {
      const { canUse, denyInteraction } = require('../utils/permissions');
      if (!canUse(interaction.member, LEVELS.staff)) {
        return denyInteraction(interaction, 'staff');
      }

      const ticket = store.getTicket(interaction.channel.id);
      if (!ticket) {
        return interaction.reply({
          content: 'This command can only be used inside a ticket channel.',
          ephemeral: true,
        });
      }

      await interaction.deferReply({ ephemeral: true });
      await ticketManager.closeTicket(interaction.channel, interaction.member);
      return interaction.editReply({ content: 'Ticket will close in a few seconds.' });
    }

    if (sub === 'approve') {
      const { canUse, denyInteraction } = require('../utils/permissions');
      if (!canUse(interaction.member, LEVELS.staff)) {
        return denyInteraction(interaction, 'staff');
      }

      const channel = interaction.options.getChannel('channel') || interaction.channel;
      await interaction.deferReply({ ephemeral: true });
      const result = await ticketManager.approvePayment(
        interaction.guild,
        channel.id,
        interaction.member
      );
      if (result.error) {
        return interaction.editReply({ content: result.error });
      }
      return interaction.editReply({
        content: 'Payment approved. Purchaser role granted and license recorded.',
      });
    }

    if (sub === 'list' || sub === 'stats') {
      const { canUse, denyInteraction } = require('../utils/permissions');
      if (!canUse(interaction.member, LEVELS.staff)) {
        return denyInteraction(interaction, 'staff');
      }

      const { tickets, totalOpen, awaitingApproval, oldest } = ticketManager.getTicketStats(
        interaction.guild.id
      );

      if (sub === 'stats') {
        const embed = new EmbedBuilder()
          .setColor(0xd40000)
          .setTitle('◆ Ticket stats')
          .addFields(
            { name: 'Open tickets', value: String(totalOpen), inline: true },
            { name: 'Awaiting approval', value: String(awaitingApproval), inline: true },
            {
              name: 'Oldest open',
              value: oldest
                ? `<#${oldest.channelId}> — <t:${Math.floor(oldest.createdAt / 1000)}:R>`
                : 'None',
              inline: false,
            }
          )
          .setTimestamp();

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      if (!tickets.length) {
        return interaction.reply({ content: 'No open tickets.', ephemeral: true });
      }

      const lines = tickets.slice(0, 20).map((t) => {
        const plan = t.planId ? ` · plan \`${t.planId}\`` : '';
        return `<#${t.channelId}> — \`${t.stage}\`${plan} — <@${t.userId}>`;
      });

      const embed = new EmbedBuilder()
        .setColor(0xd40000)
        .setTitle(`◆ Open tickets (${tickets.length})`)
        .setDescription(lines.join('\n').slice(0, 4000))
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};
