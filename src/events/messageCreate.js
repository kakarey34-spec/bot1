const store = require('../config/store');
const ticketManager = require('../services/ticketManager');

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    if (message.author.bot || !message.guild) return;

    if (store.getTicket(message.channel.id)) {
      ticketManager.touchTicketChannelActivity(message.channel.id);
    }

    await ticketManager.handleDoneKeyword(message);
    await ticketManager.handleProofMessage(message);
  },
};
