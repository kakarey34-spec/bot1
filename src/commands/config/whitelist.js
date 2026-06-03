const { SlashCommandBuilder } = require('discord.js');
const store = require('../../config/store');
const { successEmbed, baseEmbed } = require('../../utils/embeds');
const { LEVELS } = require('../../utils/permissions');

const TYPE_CHOICES = [
  { name: 'User (config access)', value: 'user' },
  { name: 'Staff role', value: 'staff' },
  { name: 'Admin role', value: 'admin' },
  { name: 'Config role', value: 'config' },
  { name: 'Ticket support role (can view tickets)', value: 'support' },
  { name: 'Extra ticket viewer role', value: 'viewer' },
  { name: 'Individual ticket viewer (user)', value: 'ticketviewer' },
];

const TYPE_MAP = {
  user: { path: 'whitelist.userIds', array: true },
  staff: { path: 'whitelist.staffRoleIds', array: true },
  admin: { path: 'whitelist.adminRoleIds', array: true },
  config: { path: 'whitelist.configRoleIds', array: true },
  support: { path: 'tickets.supportRoleIds', array: true },
  viewer: { path: 'tickets.viewerRoleIds', array: true },
  ticketviewer: { path: 'tickets.viewerUserIds', array: true },
};

function getArray(guildId, path) {
  const val = store.getPath(guildId, path);
  return Array.isArray(val) ? [...val] : [];
}

function setArray(guildId, path, arr) {
  store.setPath(guildId, path, JSON.stringify(arr));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('whitelist')
    .setDescription('Manage whitelisted users and roles for bot access')
    .addSubcommand((sub) =>
      sub
        .setName('list')
        .setDescription('Show whitelisted users and roles')
        .addStringOption((opt) =>
          opt.setName('type').setDescription('Filter by type').addChoices(...TYPE_CHOICES)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Add a user or role to a whitelist')
        .addStringOption((opt) =>
          opt.setName('type').setDescription('List type').setRequired(true).addChoices(...TYPE_CHOICES)
        )
        .addMentionableOption((opt) =>
          opt.setName('target').setDescription('User or role').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Remove a user or role from a whitelist')
        .addStringOption((opt) =>
          opt.setName('type').setDescription('List type').setRequired(true).addChoices(...TYPE_CHOICES)
        )
        .addMentionableOption((opt) =>
          opt.setName('target').setDescription('User or role').setRequired(true)
        )
    ),
  permissionLevel: LEVELS.config,
  permissionLabel: 'configurator',
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const typeFilter = interaction.options.getString('type');

    if (sub === 'list') {
      const show = typeFilter && TYPE_MAP[typeFilter] ? [typeFilter] : Object.keys(TYPE_MAP);
      const lines = show.map((t) => {
        const arr = getArray(interaction.guild.id, TYPE_MAP[t].path);
        const formatted = arr.length
          ? arr.map((id) =>
              t === 'user' || t === 'ticketviewer' ? `<@${id}>` : `<@&${id}>`
            ).join(', ')
          : '*empty*';
        return `**${t}:** ${formatted}`;
      });
      return interaction.reply({
        embeds: [baseEmbed(interaction.guild.id, 'Access Lists', lines.join('\n'))],
        ephemeral: true,
      });
    }

    const type = interaction.options.getString('type');
    const meta = TYPE_MAP[type];
    const target = interaction.options.getMentionable('target');
    if (!meta || !target) {
      return interaction.reply({ content: 'Invalid type or target.', ephemeral: true });
    }

    const id = target.id;
    let arr = getArray(interaction.guild.id, meta.path);

    if (sub === 'add') {
      if (!arr.includes(id)) arr.push(id);
    } else {
      arr = arr.filter((x) => x !== id);
    }
    setArray(interaction.guild.id, meta.path, arr);

    return interaction.reply({
      embeds: [
        successEmbed(
          interaction.guild.id,
          `${sub === 'add' ? 'Added' : 'Removed'} ${target} from **${type}** list.`
        ),
      ],
      ephemeral: true,
    });
  },
};
