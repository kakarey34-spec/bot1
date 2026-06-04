const { ActivityType } = require('discord.js');
const { startSchedulers } = require('../services/ticketScheduler');
const { startGiveawayScheduler } = require('../services/giveawayScheduler');

module.exports = {
  name: 'clientReady',
  once: true,
  async execute(client) {
    console.log(`Logged in as ${client.user.tag}`);

    if (client.slashHandler) {
      await client.slashHandler.deployCommands();
    }

    startSchedulers(client);
    startGiveawayScheduler(client);
    client.user.setActivity('VIRELLO · /help', { type: ActivityType.Watching });
  },
};
