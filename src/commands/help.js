const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getPermissionLevel, LEVELS } = require('../utils/permissions');

const COMMAND_HELP = {
  everyone: [
    'Use the **Purchase**, **Renewal**, or **Support** panels to open a private lane.',
    '**Purchase:** choose plan → payment method → pay → **Payment sent** or `done` → upload proof.',
    '**Support / Scanner:** describe your issue in the private channel for staff.',
    '`/status view` — Check scanner operational status.',
    '`/mylicense` — View your license (buyers with active access).',
  ],
  staff: [
    '`/who` — Learn what VIRELLO does and open the website.',
    '`/price` — View the current license plans.',
    '`/status set` / `/status post` — Update and publish scanner status.',
    '`/license revoke` — End a buyer\'s license and remove their role.',
    '`/license check` — View a user\'s license record.',
    '`/ticket approve` — Approve payment, grant role, and start license.',
    '`/ticket list` / `/ticket stats` — Open ticket queue.',
    '`/ticket panel` — Post Purchase, Support, or Renewal panel.',
    '`/ticket close` — Close the current ticket channel.',
    '`/kick` `/ban` `/mute` `/unmute` `/clear` — Moderation tools.',
  ],
  admin: [
    '`/say` — Send a message as the bot.',
    '`/embed` — Send a custom embed.',
    '`/ticket panel` — Post the **Purchase** or **Support** panel (`type` option).',
  ],
  config: [
    '`/config get|set|list` — View or change settings.',
    '`/config role|channel|payment` — Quick setup helpers.',
    '`/whitelist add|remove|list` — Manage access lists.',
  ],
  owner: [
    '`/rules` `/terms` `/buyerterms` `/privacypolicy` — Post legal embeds in this channel.',
  ],
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show commands available to your permission level'),
  permissionLevel: LEVELS.everyone,
  async execute(interaction) {
    const level = getPermissionLevel(interaction.member);

    const sections = [];
    sections.push({ title: 'Everyone', lines: COMMAND_HELP.everyone });
    if (level >= LEVELS.staff) sections.push({ title: 'Staff', lines: COMMAND_HELP.staff });
    if (level >= LEVELS.admin) sections.push({ title: 'Admin', lines: COMMAND_HELP.admin });
    if (level >= LEVELS.config) sections.push({ title: 'Configuration', lines: COMMAND_HELP.config });
    if (level >= LEVELS.owner) sections.push({ title: 'Owner', lines: COMMAND_HELP.owner });

    const embed = new EmbedBuilder()
      .setTitle('VIRELLO — Help')
      .setDescription(
        `Use **/** in Discord to browse all commands with descriptions.\nYour access level: **${['Member', 'Staff', 'Admin', 'Configurator', 'Owner'][level] || 'Member'}**`
      )
      .setColor(0xd40000)
      .setTimestamp();

    for (const section of sections) {
      embed.addFields({
        name: section.title,
        value: section.lines.join('\n'),
      });
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
