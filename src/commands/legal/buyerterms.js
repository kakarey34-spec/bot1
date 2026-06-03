const createLegalCommand = require('./_legalFactory');

module.exports = createLegalCommand(
  'buyerterms',
  'Post the buyer terms embed in this channel (owner only)',
  'buyerterms'
);
