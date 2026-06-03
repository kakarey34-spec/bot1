const { BRAND, withLogoPayload } = require('./brand');
const { virelloEmbed } = require('./ticketUi');
const documents = require('../content/legalDocuments');

function buildLegalEmbed(guildId, docKey) {
  const doc = documents[docKey];
  if (!doc) throw new Error(`Unknown legal document: ${docKey}`);

  const embed = virelloEmbed(guildId, {
    color: BRAND.red,
    title: doc.title,
    description: doc.description,
    fields: doc.fields,
    footer: false,
  }).setFooter({ text: doc.footer || 'VIRELLO' });

  return withLogoPayload([embed]);
}

module.exports = { buildLegalEmbed };
