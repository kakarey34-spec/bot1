const { EmbedBuilder } = require('discord.js');
const { PAYMENT_IDS, TICKET_IDS } = require('../utils/components');
const { parseTicketOpenCategory } = require('../utils/ticketPanel');
const { canUse, LEVELS } = require('../utils/permissions');
const ticketManager = require('../services/ticketManager');
const { REP_CHANNEL_ID, REP_ROLE_ID } = require('../commands/rep');

const PAYMENT_KEY_MAP = {
  [PAYMENT_IDS.paypal]: 'paypal',
  [PAYMENT_IDS.ethereum]: 'ethereum',
  [PAYMENT_IDS.litecoin]: 'litecoin',
  [PAYMENT_IDS.greek_paysafe]: 'greek_paysafe',
};

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    if (!interaction.guild) return;

    try {
      if (interaction.isAutocomplete()) {
        const command = client.commands?.get(interaction.commandName);
        if (command?.autocomplete) {
          await command.autocomplete(interaction);
        }
        return;
      }

      if (interaction.isChatInputCommand()) {
        if (client.slashHandler) {
          await client.slashHandler.handleSlashCommand(interaction);
        }
        return;
      }

      if (interaction.isModalSubmit()) {
        if (!interaction.customId.startsWith('rep:')) return;

        const [, channelId, userId] = interaction.customId.split(':');
        if (
          channelId !== REP_CHANNEL_ID ||
          interaction.channelId !== REP_CHANNEL_ID ||
          interaction.user.id !== userId
        ) {
          return interaction.reply({
            content: 'This rating form can no longer be submitted here.',
            ephemeral: true,
          });
        }

        if (!interaction.member.roles.cache.has(REP_ROLE_ID)) {
          return interaction.reply({
            content: 'You do not have permission to submit this rating.',
            ephemeral: true,
          });
        }

        const starsRaw = interaction.fields.getTextInputValue('stars').trim();
        const stars = Number.parseInt(starsRaw, 10);
        if (!Number.isInteger(stars) || stars < 1 || stars > 5 || String(stars) !== starsRaw) {
          return interaction.reply({
            content: 'Please enter a whole number from 1 to 5 for the stars.',
            ephemeral: true,
          });
        }

        const rating = interaction.fields.getTextInputValue('rating').trim();
        const starText = `${':star:'.repeat(stars)} ${':white_small_square:'.repeat(5 - stars)} (${stars}/5)`;
        const avatarUrl = interaction.user.displayAvatarURL({ size: 256 });
        const embed = new EmbedBuilder()
          .setColor(0xd40000)
          .setAuthor({
            name: `${interaction.user.username} left a service rating`,
            iconURL: avatarUrl,
          })
          .setTitle('Service Review')
          .setDescription(`> ${rating.replace(/\n/g, '\n> ')}`)
          .setThumbnail(avatarUrl)
          .addFields(
            { name: 'Repper', value: `${interaction.user}`, inline: true },
            { name: 'Stars', value: starText, inline: true }
          )
          .setFooter({ text: `Review submitted by ${interaction.user.tag}` })
          .setTimestamp();

        await interaction.channel.send({
          content: `${interaction.user}`,
          embeds: [embed],
          allowedMentions: { users: [interaction.user.id] },
        });

        return interaction.reply({
          content: 'Your rating has been posted. Thank you!',
          ephemeral: true,
        });
      }

      if (!interaction.isButton()) return;

      const customId = interaction.customId;

      const ticketCategory = parseTicketOpenCategory(customId);
      if (ticketCategory) {
        await interaction.deferReply({ ephemeral: true });
        const result = await ticketManager.createTicket(
          interaction.guild,
          interaction.member,
          ticketCategory
        );
        if (result.error) {
          return interaction.editReply({ content: result.error });
        }
        return interaction.editReply({
          content: `Your ticket has been created: ${result.channel}`,
        });
      }

      if (customId.startsWith('payment_')) {
        const methodKey = PAYMENT_KEY_MAP[customId] || customId.replace('payment_', '');
        const result = await ticketManager.selectPaymentMethod(
          interaction.channel,
          interaction.user.id,
          methodKey
        );
        if (result.error) {
          return interaction.reply({ content: result.error, ephemeral: true });
        }
        return interaction.reply({ content: 'Payment details sent above.', ephemeral: true });
      }

      if (customId === TICKET_IDS.paymentDone) {
        const result = await ticketManager.markPaymentDone(interaction.channel, interaction.user.id);
        if (result.error) {
          return interaction.reply({ content: result.error, ephemeral: true });
        }
        return interaction.reply({
          content: 'Please upload your proof of payment in this channel.',
          ephemeral: true,
        });
      }

      if (customId.startsWith(`${TICKET_IDS.approve}:`)) {
        if (!canUse(interaction.member, LEVELS.staff)) {
          return interaction.reply({
            content: 'Only authorized staff can approve payments.',
            ephemeral: true,
          });
        }
        const channelId = customId.split(':')[1];
        await interaction.deferReply({ ephemeral: true });
        const result = await ticketManager.approvePayment(
          interaction.guild,
          channelId,
          interaction.member
        );
        if (result.error) {
          return interaction.editReply({ content: result.error });
        }
        return interaction.editReply({ content: 'Payment approved and role granted.' });
      }

      if (customId.startsWith(`${TICKET_IDS.deny}:`)) {
        if (!canUse(interaction.member, LEVELS.staff)) {
          return interaction.reply({
            content: 'Only authorized staff can deny payments.',
            ephemeral: true,
          });
        }
        const channelId = customId.split(':')[1];
        await interaction.deferReply({ ephemeral: true });
        const result = await ticketManager.denyPayment(
          interaction.guild,
          channelId,
          interaction.member
        );
        if (result.error) {
          return interaction.editReply({ content: result.error });
        }
        return interaction.editReply({ content: 'Payment denied.' });
      }

      if (customId === TICKET_IDS.close) {
        if (!canUse(interaction.member, LEVELS.staff)) {
          return interaction.reply({
            content: 'Only staff can close tickets from this button.',
            ephemeral: true,
          });
        }
        await interaction.deferReply({ ephemeral: true });
        await ticketManager.closeTicket(interaction.channel, interaction.member);
        return interaction.editReply({ content: 'Ticket will close in a few seconds.' });
      }
    } catch (err) {
      console.error('Interaction error:', err);
      const payload = { content: 'Something went wrong.', ephemeral: true };
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(payload).catch(() => null);
      } else {
        await interaction.reply(payload).catch(() => null);
      }
    }
  },
};
