const { ActivityType } = require('discord.js');
const { startSchedulers } = require('../services/ticketScheduler');
const { startGiveawayScheduler } = require('../services/giveawayScheduler');
const shoppexFulfillment = require('../services/shoppexFulfillment');

module.exports = {
  name: 'clientReady',
  once: true,
  async execute(client) {
    console.log(`Logged in as ${client.user.tag}`);

    if (client.slashHandler) {
      await client.slashHandler.deployCommands();
    }

    shoppexFulfillment.setClient(client);
    startSchedulers(client);
    startGiveawayScheduler(client);
    client.user.setActivity('VIRELLO · /help', { type: ActivityType.Watching });
  },
};
