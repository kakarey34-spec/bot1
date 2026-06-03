const store = require('../config/store');
const ticketManager = require('./ticketManager');
const licenseService = require('./licenseService');
const { upsertBuyerRegistry } = require('../utils/buyerRegistry');

const { STAGES } = ticketManager;

const INACTIVE_STAGES = new Set([
  STAGES.SELECT_PLAN,
  STAGES.SELECT_PAYMENT,
  STAGES.AWAITING_PAYMENT,
  STAGES.AWAITING_PROOF,
]);

async function processInactiveTickets(client) {
  for (const guild of client.guilds.cache.values()) {
    const config = store.getGuild(guild.id);
    const hours = config.tickets.inactiveCloseHours;
    if (!hours || hours <= 0) continue;

    const maxIdle = hours * 60 * 60 * 1000;
    const tickets = store.listTicketsForGuild(guild.id);

    for (const ticket of tickets) {
      if (!INACTIVE_STAGES.has(ticket.stage)) continue;

      const channel =
        guild.channels.cache.get(ticket.channelId) ||
        (await guild.channels.fetch(ticket.channelId).catch(() => null));
      if (!channel) {
        store.deleteTicket(ticket.channelId);
        continue;
      }

      const last = ticket.lastActivityAt || ticket.createdAt || 0;
      if (Date.now() - last < maxIdle) continue;

      await channel
        .send(
          '**Lane closed automatically** — no activity for the configured period. Open a new lane from the panel if you still need help.'
        )
        .catch(() => null);

      await ticketManager.closeTicket(channel, { user: { tag: 'VIRELLO (inactivity)' } });
    }
  }
}

async function processLicenses(client) {
  for (const guild of client.guilds.cache.values()) {
    const config = store.getGuild(guild.id);
    const warningDays = config.license?.expiryWarningDays || [7, 3, 1];

    for (const entry of store.listLicensesForGuild(guild.id)) {
      const { userId, ...license } = entry;
      const status = licenseService.licenseStatus(license);

      if (status.expired && !license.expired) {
        await licenseService.removePurchaserRole(guild, userId);
        const updated = licenseService.markLicenseExpired(guild.id, userId);
        const user = await client.users.fetch(userId).catch(() => null);
        if (user && updated) {
          await licenseService.sendExpiredDm(user, updated);
          await upsertBuyerRegistry(guild, userId, updated);
        }
        continue;
      }

      if (status.expired) continue;

      for (const days of warningDays) {
        const key = `${days}d`;
        if (status.daysLeft > days) continue;
        if ((license.warningsSent || []).includes(key)) continue;

        const user = await client.users.fetch(userId).catch(() => null);
        if (user) await licenseService.sendExpiryWarningDm(user, guild.id, license, days);

        license.warningsSent = [...(license.warningsSent || []), key];
        store.setLicense(guild.id, userId, license);
      }
    }
  }
}

function startSchedulers(client) {
  const run = async () => {
    try {
      await processInactiveTickets(client);
      await processLicenses(client);
    } catch (err) {
      console.error('Scheduler error:', err);
    }
  };

  run();
  setInterval(run, 15 * 60 * 1000);
}

module.exports = { startSchedulers, processInactiveTickets, processLicenses };
