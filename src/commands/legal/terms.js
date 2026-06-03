const createLegalCommand = require('./_legalFactory');

module.exports = createLegalCommand(
  'terms',
  'Post the Terms of Service embed in this channel (owner only)',
  'terms'
);
