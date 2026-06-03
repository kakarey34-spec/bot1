const { SlashCommandBuilder, ChannelType } = require('discord.js');
const store = require('../../config/store');
const { baseEmbed, successEmbed } = require('../../utils/embeds');
const { LEVELS } = require('../../utils/permissions');

const CONFIG_PATHS = [
  'prefix',
  'tickets.categoryId',
  'tickets.supportRoleIds',
  'tickets.viewerRoleIds',
  'tickets.viewerUserIds',
  'tickets.approvalChannelPrefix',
  'tickets.logChannelId',
  'tickets.welcomeMessage',
  'tickets.awaitingProofMessage',
  'tickets.waitingApprovalMessage',
  'tickets.approvedMessage',
  'payments.paypal.details',
  'payments.paypal.enabled',
  'payments.ethereum.details',
  'payments.litecoin.details',
  'payments.greek_paysafe.details',
  'roles.autoRoleId',
  'roles.purchaserRoleId',
  'roles.muteRoleId',
  'embeds.color',
  'embeds.footer',
  'moderation.muteDurationMinutes',
];

const PAYMENT_METHODS = [
  { name: 'PayPal', value: 'paypal' },
  { name: 'Ethereum', value: 'ethereum' },
  { name: 'Litecoin', value: 'litecoin' },
  { name: 'Greek Paysafe', value: 'greek_paysafe' },
];

const ROLE_KEYS = [
  { name: 'Auto role on join', value: 'autorole' },
  { name: 'Purchaser role', value: 'purchaser' },
  { name: 'Mute role', value: 'mute' },
  { name: 'Staff role', value: 'staff' },
];

const CHANNEL_KEYS = [
  { name: 'Ticket category', value: 'category' },
  { name: 'Ticket logs (fallback)', value: 'logs' },
  { name: 'Payment ticket logs', value: 'logs_payments' },
  { name: 'Support ticket logs', value: 'logs_support' },
  { name: 'Scanner ticket logs', value: 'logs_scanner' },
  { name: 'Rep reviews channel', value: 'rep' },
  { name: 'Panel channel (reference)', value: 'panel' },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('View or change bot configuration for this server')
    .addSubcommand((sub) =>
      sub
        .setName('get')
        .setDescription('View a config value by path')
        .addStringOption((opt) =>
          opt
            .setName('path')
            .setDescription('Config path, e.g. payments.paypal.details')
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('set')
        .setDescription('Set a config value')
        .addStringOption((opt) =>
          opt.setName('path').setDescription('Config path').setRequired(true).setAutocomplete(true)
        )
        .addStringOption((opt) =>
          opt.setName('value').setDescription('New value').setRequired(true)
        )
    )
    .addSubcommand((sub) => sub.setName('list').setDescription('List common config paths'))
    .addSubcommand((sub) =>
      sub
        .setName('role')
        .setDescription('Set a role ID for autorole, purchaser, mute, or staff')
        .addStringOption((opt) =>
          opt.setName('key').setDescription('Which role to set').setRequired(true).addChoices(...ROLE_KEYS)
        )
        .addRoleOption((opt) => opt.setName('role').setDescription('Role').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('channel')
        .setDescription('Set ticket category, logs, or panel reference channel')
        .addStringOption((opt) =>
          opt.setName('key').setDescription('Which channel to set').setRequired(true).addChoices(...CHANNEL_KEYS)
        )
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('Channel or category')
            .setRequired(true)
            .addChannelTypes(
              ChannelType.GuildText,
              ChannelType.GuildAnnouncement,
              ChannelType.GuildCategory
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('payment')
        .setDescription('Set payment instructions for a method')
        .addStringOption((opt) =>
          opt
            .setName('method')
            .setDescription('Payment method')
            .setRequired(true)
            .addChoices(...PAYMENT_METHODS)
        )
        .addStringOption((opt) =>
          opt.setName('details').setDescription('Payment details shown in tickets').setRequired(true)
        )
    ),
  permissionLevel: LEVELS.config,
  permissionLabel: 'configurator',
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'list') {
      return interaction.reply({
        embeds: [
          baseEmbed(
            interaction.guild.id,
            'Config Paths',
            CONFIG_PATHS.map((p) => `\`${p}\``).join('\n')
          ),
        ],
        ephemeral: true,
      });
    }

    if (sub === 'get') {
      const path = interaction.options.getString('path');
      const value = store.getPath(interaction.guild.id, path);
      const display =
        value === undefined
          ? '*not set*'
          : typeof value === 'object'
            ? '```json\n' + JSON.stringify(value, null, 2) + '\n```'
            : String(value);
      return interaction.reply({
        embeds: [baseEmbed(interaction.guild.id, `Config: ${path}`, display.slice(0, 4000))],
        ephemeral: true,
      });
    }

    if (sub === 'set') {
      const path = interaction.options.getString('path');
      const value = interaction.options.getString('value');
      const parsed = store.setPath(interaction.guild.id, path, value);
      return interaction.reply({
        embeds: [
          successEmbed(
            interaction.guild.id,
            `Set \`${path}\` to:\n\`\`\`\n${String(parsed).slice(0, 500)}\n\`\`\``
          ),
        ],
        ephemeral: true,
      });
    }

    if (sub === 'role') {
      const key = interaction.options.getString('key');
      const role = interaction.options.getRole('role');
      const map = {
        autorole: 'roles.autoRoleId',
        purchaser: 'roles.purchaserRoleId',
        mute: 'roles.muteRoleId',
        staff: 'roles.staffRoleIds',
      };
      if (key === 'staff') {
        const config = store.getGuild(interaction.guild.id);
        const ids = new Set(config.roles.staffRoleIds || []);
        ids.add(role.id);
        store.setPath(interaction.guild.id, 'roles.staffRoleIds', JSON.stringify([...ids]));
      } else {
        store.setPath(interaction.guild.id, map[key], role.id);
      }
      return interaction.reply({
        embeds: [successEmbed(interaction.guild.id, `Role \`${key}\` updated.`)],
        ephemeral: true,
      });
    }

    if (sub === 'channel') {
      const key = interaction.options.getString('key');
      const channel = interaction.options.getChannel('channel');
      const map = {
        category: 'tickets.categoryId',
        logs: 'tickets.logChannelId',
        panel: 'tickets.panelChannelId',
        rep: 'channels.repChannelId',
      };
      if (key === 'logs_payments') {
        const config = store.getGuild(interaction.guild.id);
        const categoryLogs = { ...(config.tickets.categoryLogChannels || {}), payments: channel.id };
        store.setPath(interaction.guild.id, 'tickets.categoryLogChannels', JSON.stringify(categoryLogs));
      } else if (key === 'logs_support') {
        const config = store.getGuild(interaction.guild.id);
        const categoryLogs = { ...(config.tickets.categoryLogChannels || {}), support: channel.id };
        store.setPath(interaction.guild.id, 'tickets.categoryLogChannels', JSON.stringify(categoryLogs));
      } else if (key === 'logs_scanner') {
        const config = store.getGuild(interaction.guild.id);
        const categoryLogs = { ...(config.tickets.categoryLogChannels || {}), scanner: channel.id };
        store.setPath(interaction.guild.id, 'tickets.categoryLogChannels', JSON.stringify(categoryLogs));
      } else {
        store.setPath(interaction.guild.id, map[key], channel.id);
      }
      return interaction.reply({
        embeds: [successEmbed(interaction.guild.id, `Channel \`${key}\` set.`)],
        ephemeral: true,
      });
    }

    if (sub === 'payment') {
      const method = interaction.options.getString('method');
      const details = interaction.options.getString('details');
      store.setPath(interaction.guild.id, `payments.${method}.details`, details);
      return interaction.reply({
        embeds: [successEmbed(interaction.guild.id, `Payment details for **${method}** updated.`)],
        ephemeral: true,
      });
    }
  },
  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);
    if (focused.name !== 'path') return interaction.respond([]);

    const query = focused.value.toLowerCase();
    const matches = CONFIG_PATHS.filter((p) => p.toLowerCase().includes(query)).slice(0, 25);
    await interaction.respond(matches.map((p) => ({ name: p, value: p })));
  },
};
