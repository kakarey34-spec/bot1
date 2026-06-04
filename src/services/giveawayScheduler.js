const store = require('../config/store');
const { endGiveaway } = require('./giveawayService');

async function processDueGiveaways(client) {
  store.pruneEndedGiveaways();
  const now = Date.now();
  for (const giveaway of store.listActiveGiveaways()) {
    if (giveaway.endsAt > now) continue;
    try {
      await endGiveaway(client, giveaway.messageId);
    } catch (err) {
      console.error(`Giveaway end failed (${giveaway.messageId}):`, err);
    }
  }
}

function startGiveawayScheduler(client) {
  const run = () => processDueGiveaways(client).catch((err) => console.error('Giveaway scheduler:', err));
  run();
  setInterval(run, 30 * 1000);
}

module.exports = { startGiveawayScheduler, processDueGiveaways };
