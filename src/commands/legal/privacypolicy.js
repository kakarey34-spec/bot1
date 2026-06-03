const createLegalCommand = require('./_legalFactory');

module.exports = createLegalCommand(
  'privacypolicy',
  'Post the privacy policy embed in this channel (owner only)',
  'privacypolicy'
);
