const createLegalCommand = require('./_legalFactory');

module.exports = createLegalCommand(
  'rules',
  'Post the VIRELLO server rules embed in this channel (owner only)',
  'rules'
);
