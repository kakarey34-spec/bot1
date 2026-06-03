const { SlashCommandBuilder } = require('discord.js');
const { LEVELS } = require('../../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Delete recent messages in this channel')
    .addIntegerOption((opt) =>
      opt
        .setName('amount')
        .setDescription('Number of messages to delete (1–100)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    ),
  permissionLevel: LEVELS.staff,
  permissionLabel: 'staff',
  async execute(interaction) {
    const amount = interaction.options.getInteger('amount');
    await interaction.deferReply({ ephemeral: true });

    const deleted = await interaction.channel.bulkDelete(amount, true).catch(async () => {
      const msgs = await interaction.channel.messages.fetch({ limit: amount });
      for (const msg of msgs.values()) {
        await msg.delete().catch(() => null);
      }
      return { size: msgs.size };
    });

    const count = deleted?.size ?? amount;
    return interaction.editReply({ content: `Deleted ${count} message(s).` });
  },
};
