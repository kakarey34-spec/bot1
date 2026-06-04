const { SlashCommandBuilder } = require('discord.js');
const { LEVELS, canUse, denyInteraction } = require('../utils/permissions');
const promoService = require('../services/promoService');
const { PROMO_TYPES } = promoService;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('promo')
    .setDescription('Create and use promotional codes')
    .addSubcommand((sub) =>
      sub
        .setName('create')
        .setDescription('Create a promo code (admin)')
        .addStringOption((opt) =>
          opt.setName('code').setDescription('Code users will enter').setRequired(true).setMaxLength(32)
        )
        .addStringOption((opt) =>
          opt
            .setName('type')
            .setDescription('Promo effect')
            .setRequired(true)
            .addChoices(
              { name: 'Extra days on license', value: PROMO_TYPES.extra_days },
              { name: 'Discount percent (reduces ticket total)', value: PROMO_TYPES.discount_percent }
            )
        )
        .addNumberOption((opt) =>
          opt
            .setName('value')
            .setDescription('Days to add OR discount percent (1–90)')
            .setRequired(true)
            .setMinValue(1)
        )
        .addIntegerOption((opt) =>
          opt
            .setName('max_uses')
            .setDescription('How many times the code can be used (e.g. 10, 100)')
            .setMinValue(1)
            .setMaxValue(100000)
        )
        .addIntegerOption((opt) =>
          opt
            .setName('valid_days')
            .setDescription('How many days the code stays active (e.g. 7, 30)')
            .setMinValue(1)
            .setMaxValue(365)
        )
        .addStringOption((opt) =>
          opt.setName('note').setDescription('Internal note for staff').setMaxLength(200)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('delete')
        .setDescription('Delete a promo code (admin)')
        .addStringOption((opt) =>
          opt.setName('code').setDescription('Code to remove').setRequired(true)
        )
    )
    .addSubcommand((sub) => sub.setName('list').setDescription('List promo codes (admin)'))
    .addSubcommand((sub) =>
      sub
        .setName('apply')
        .setDescription('Apply a promo code in your open purchase/renewal ticket')
        .addStringOption((opt) =>
          opt.setName('code').setDescription('Promo code').setRequired(true)
        )
    ),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'create' || sub === 'delete' || sub === 'list') {
      if (!canUse(interaction.member, LEVELS.admin)) {
        return denyInteraction(interaction, 'admin');
      }
    }

    if (sub === 'create') {
      const maxUses = interaction.options.getInteger('max_uses');
      const validDays = interaction.options.getInteger('valid_days');

      const result = promoService.createPromoRecord(interaction.guild.id, {
        code: interaction.options.getString('code'),
        type: interaction.options.getString('type'),
        value: interaction.options.getNumber('value'),
        maxUses: maxUses ?? null,
        validDays: validDays ?? null,
        createdBy: interaction.user.id,
        note: interaction.options.getString('note'),
      });

      if (result.error) {
        return interaction.reply({ content: result.error, ephemeral: true });
      }

      const p = result.promo;
      return interaction.reply({
        content: [
          `Created promo **${p.code}** — ${promoService.promoLabel(p)}`,
          promoService.formatPromoLimits(p),
        ].join('\n'),
        ephemeral: true,
      });
    }

    if (sub === 'delete') {
      const code = interaction.options.getString('code');
      if (!promoService.deletePromo(interaction.guild.id, code)) {
        return interaction.reply({ content: 'Promo code not found.', ephemeral: true });
      }
      return interaction.reply({
        content: `Deleted promo **${promoService.normalizeCode(code)}**.`,
        ephemeral: true,
      });
    }

    if (sub === 'list') {
      const promos = promoService.listPromos(interaction.guild.id);
      if (!promos.length) {
        return interaction.reply({ content: 'No promo codes configured.', ephemeral: true });
      }

      const lines = promos.map(
        (p) => `• **${p.code}** — ${promoService.promoLabel(p)}\n  ${promoService.formatPromoLimits(p)}`
      );

      return interaction.reply({
        content: `**Promo codes**\n\n${lines.join('\n\n')}`.slice(0, 2000),
        ephemeral: true,
      });
    }

    if (sub === 'apply') {
      const ticketManager = require('../services/ticketManager');
      await interaction.deferReply({ ephemeral: true });
      const result = await ticketManager.applyPromoCodeToTicket(
        interaction.channel,
        interaction.user.id,
        interaction.options.getString('code')
      );
      if (result.error) {
        return interaction.editReply({ content: result.error });
      }
      return interaction.editReply({
        content: `Promo **${result.promo.code}** applied. Check this channel for the amount you need to send.`,
      });
    }
  },
};
