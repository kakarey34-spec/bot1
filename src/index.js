require('dotenv').config();
const http = require('http');
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { loadEvents } = require('./handlers/eventHandler');
const { createSlashCommandHandler } = require('./handlers/commandHandler');
const store = require('./config/store');
const backup = require('./services/backupService');
const { startPricingSyncLoop } = require('./services/dashboardSync');
const shoppexFulfillment = require('./services/shoppexFulfillment');
const { handleShoppexFulfillRequest } = require('./webhooks/shoppexFulfill');

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

const { handleAdminRequest } = require('./admin/routes');

const port = process.env.PORT || 3000;
http
  .createServer(async (req, res) => {
    const path = (req.url || '/').split('?')[0];
    if (path === '/webhooks/shoppex-fulfill') {
      await handleShoppexFulfillRequest(req, res);
      return;
    }
    if (path === '/admin' || path.startsWith('/admin/')) {
      await handleAdminRequest(req, res);
      return;
    }
    const isHealthRoute = path === '/' || path === '/health';
    if (!isHealthRoute) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    try {
      const payload = await backup.getHealthStatus();
      const statusCode = payload.status === 'ok' ? 200 : 503;
      const body = JSON.stringify(payload);
      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(body);
    } catch (error) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'degraded', detail: 'Health check failed' }));
    }
  })
  .listen(port, () => {
    console.log(`Health server listening on port ${port}`);
  });

store
  .init()
  .then(() => {
    backup.startScheduler();
    startPricingSyncLoop();
    shoppexFulfillment.setClient(client);
    return client.login(token);
  })
  .catch((err) => {
    console.error('Failed to start:', err);
    process.exit(1);
  });
