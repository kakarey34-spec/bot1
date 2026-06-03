const ticketManager = require('../services/ticketManager');

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    if (message.author.bot || !message.guild) return;

    await ticketManager.handleDoneKeyword(message);
    await ticketManager.handleProofMessage(message);
  },
};
