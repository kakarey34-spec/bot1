const { withLogoPayload } = require('./brand');
const { virelloEmbed } = require('./ticketUi');

function buildRenewalPanelEmbed(guildId) {
  const embed = virelloEmbed(guildId, {
    title: '◆ VIRELLO — License Renewal',
    description:
      'Extend or restore your access before or after expiry. Opens the same private purchase lane as a new order.',
  }).addFields(
    {
      name: 'Before you renew',
      value:
        '• Check `/mylicense` for your expiry date\n• Have payment proof ready\n• One open lane at a time',
      inline: false,
    },
    {
      name: 'After approval',
      value: 'Time is **added** to your current license if still active, or starts fresh if expired.',
      inline: false,
    }
  );

  return withLogoPayload([embed]);
}

module.exports = { buildRenewalPanelEmbed };
