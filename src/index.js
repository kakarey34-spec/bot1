require('dotenv').config();
const http = require('http');
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { loadEvents } = require('./handlers/eventHandler');
const { createSlashCommandHandler } = require('./handlers/commandHandler');
const store = require('./config/store');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildModeration,
  ],
  partials: [Partials.Channel, Partials.Message],
});

client.slashHandler = createSlashCommandHandler(client);
loadEvents(client);

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('Missing DISCORD_TOKEN in .env');
  process.exit(1);
}

if (!process.env.CLIENT_ID) {
  console.warn('CLIENT_ID is not set — slash command registration uses the bot user id after login.');
}

const port = process.env.PORT || 3000;
http
  .createServer((req, res) => {
    const isHealthRoute = req.url === '/' || req.url === '/health';
    res.writeHead(isHealthRoute ? 200 : 404, { 'Content-Type': 'text/plain' });
    res.end(isHealthRoute ? 'VIRELLO bot is online' : 'Not found');
  })
  .listen(port, () => {
    console.log(`Health server listening on port ${port}`);
  });

store
  .init()
  .then(() => client.login(token))
  .catch((err) => {
    console.error('Failed to start:', err);
    process.exit(1);
  });
