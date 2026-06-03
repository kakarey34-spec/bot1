const { ActivityType } = require('discord.js');

module.exports = {
  name: 'clientReady',
  once: true,
  async execute(client) {
    console.log(`Logged in as ${client.user.tag}`);

    if (client.slashHandler) {
      await client.slashHandler.deployCommands();
    }

    client.user.setActivity('VIRELLO · /help', { type: ActivityType.Watching });
  },
};
