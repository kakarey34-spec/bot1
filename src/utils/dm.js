/** Send a DM via an explicit DM channel (more reliable than user.send alone). */
async function sendUserDm(client, userId, payload) {
  const user = await client.users.fetch(userId);
  const dmChannel = await user.createDM();
  await dmChannel.send(payload);
  return { ok: true };
}

async function trySendUserDm(client, userId, payload) {
  try {
    await sendUserDm(client, userId, payload);
    return { ok: true };
  } catch (err) {
    console.warn(`DM failed for ${userId}:`, err.message);
    return {
      ok: false,
      error:
        'Could not send a DM. Enable **Direct Messages** from server members (Privacy & Safety) or message the bot first.',
    };
  }
}

module.exports = { sendUserDm, trySendUserDm };
