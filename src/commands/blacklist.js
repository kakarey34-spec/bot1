const { SlashCommandBuilder } = require('discord.js');
const store = require('../config/store');
const { successEmbed, baseEmbed } = require('../utils/embeds');
const { LEVELS } = require('../utils/permissions');

function getBlacklist(guildId) {
  const val = store.getPath(guildId, 'blacklist.ticketUserIds');
  return Array.isArray(val) ? [...val] : [];
}

function setBlacklist(guildId, ids) {
  store.setPath(guildId, 'blacklist.ticketUserIds', JSON.stringify(ids));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('blacklist')
    .setDescription('Block users from opening purchase or renewal lanes (staff)')
    .addSubcommand((sub) => sub.setName('list').setDescription('Show ticket blacklisted users'))
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Block a user from opening purchase lanes')
        .addUserOption((opt) =>
          opt.setName('user').setDescription('User to block').setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName('reason').setDescription('Internal note (optional)')
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Unblock a user from purchase lanes')
        .addUserOption((opt) =>
          opt.setName('user').setDescription('User to unblock').setRequired(true)
        )
    ),
  permissionLevel: LEVELS.staff,
  permissionLabel: 'staff',
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'list') {
      const ids = getBlacklist(interaction.guild.id);
      const formatted = ids.length ? ids.map((id) => `<@${id}> (\`${id}\`)`).join('\n') : '*empty*';
      return interaction.reply({
        embeds: [baseEmbed(interaction.guild.id, 'Ticket blacklist', formatted)],
        ephemeral: true,
      });
    }

    const user = interaction.options.getUser('user');
    let ids = getBlacklist(interaction.guild.id);

    if (sub === 'add') {
      if (!ids.includes(user.id)) ids.push(user.id);
      setBlacklist(interaction.guild.id, ids);
      const reason = interaction.options.getString('reason');
      const note = reason ? `\nNote: ${reason}` : '';
      return interaction.reply({
        embeds: [
          successEmbed(
            interaction.guild.id,
            `**${user.tag}** cannot open purchase or renewal lanes.${note}`
          ),
        ],
        ephemeral: true,
      });
    }

    ids = ids.filter((id) => id !== user.id);
    setBlacklist(interaction.guild.id, ids);
    return interaction.reply({
      embeds: [successEmbed(interaction.guild.id, `**${user.tag}** removed from ticket blacklist.`)],
      ephemeral: true,
    });
  },
};
