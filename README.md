# Virello Bot

Professional Discord bot with **ticket-based payments**, **staff whitelisting**, **moderation**, **messaging utilities**, and **full in-Discord configuration** — all via **slash commands** (`/`).

## Features

| Area | Capabilities |
|------|----------------|
| **Tickets & payments** | Open tickets via **Purchase** or **Support** panel buttons; purchase flow uses PayPal, Ethereum, Litecoin, or Greek Paysafe; confirm with button or `done`; upload proof; staff approve/deny with buttons or `/ticket approve` |
| **Access control** | Tiered permissions: member → staff → admin → configurator; whitelisted users and roles |
| **Help** | `/help` shows commands for your permission level; Discord lists every `/` command with descriptions |
| **Messaging** | `/say` and `/embed` for admins |
| **Automation** | Auto-role on join |
| **Moderation** | `/kick`, `/ban`, `/mute`, `/unmute`, `/clear` |
| **Configuration** | `/config`, `/whitelist` — no file editing required on the server |

## Requirements

- Node.js 18+
- A Discord application with bot token
- **Message Content Intent** enabled (for `done` keyword and proof uploads in ticket channels)
- **Server Members Intent** enabled (for auto-role on join)

### Bot permissions (recommended)

`Manage Channels`, `Manage Roles`, `Kick Members`, `Ban Members`, `Moderate Members`, `Manage Messages`, `Send Messages`, `Embed Links`, `Attach Files`, `Read Message History`, `View Channels`

## Setup

1. Clone or copy this project.
2. Install dependencies:

```bash
npm install
```

3. Copy `.env.example` to `.env` and set:

```env
DISCORD_TOKEN=your_bot_token
CLIENT_ID=your_application_id
GUILD_ID=your_server_id
```

`CLIENT_ID` is under **Developer Portal → General Information → Application ID**.  
Set `GUILD_ID` while testing so slash commands appear in that server within seconds (remove later for global commands).

4. Invite the bot with the `applications.commands` scope and the permissions above.
5. Start the bot:

```bash
npm start
```

Slash commands register automatically on startup.

## Quick start (first-time server setup)

Run these as a user with **owner** or **config** access (add yourself first if needed):

```
/whitelist add type:config target:@YourAdminRole
/whitelist add type:support target:@YourStaffRole
/whitelist add type:staff target:@YourStaffRole
/config channel key:category channel:#ticket-category
/config channel key:logs channel:#ticket-logs
/config role key:purchaser role:@CustomerRole
/config role key:autorole role:@MemberRole
/config payment method:paypal details:Send to: you@paypal.com | Note: Discord username
/config payment method:ethereum details:ETH: 0xYourAddress
/ticket panel type:purchase
/ticket panel type:support
```

Post the **Purchase** panel in your shop channel (one **Purchase** button). Post the **Support** panel in your help channel (**Support** and **Scanner Problems** buttons). Purchasers receive the purchaser role when staff approve payment tickets.

## Ticket flow

1. User clicks a button on the **Purchase** or **Support** panel.
2. Bot creates a private channel and shows payment method buttons.
3. User selects a method → receives payment details → clicks **Done** or types `done`.
4. User uploads proof (image or text).
5. The ticket channel is renamed to `waiting-manual-approval-…` and staff with configured viewer roles are pinged.
6. Staff use **Approve** / **Deny** buttons.
7. On approve, the configured purchaser role is granted.

**Who can see tickets:** Only the ticket owner, the bot, and roles/users you configure — `tickets.supportRoleIds`, staff/admin whitelist roles, `/whitelist add` type **support** / **viewer**, or `/config role` key **staff**. Everyone else is denied. (Server admins with the **Administrator** permission can still see all channels — that is a Discord limitation.)

## Commands reference

Type `/` in Discord to browse commands and descriptions.

| Command | Who | Purpose |
|---------|-----|---------|
| `/ticket panel` | Admin | Post Purchase or Support panel (`type` option) |
| `/ticket close` | Staff | Close current ticket |
| `/ticket approve` | Staff | Approve payment |
| `/help` | Everyone | Permission-filtered help |
| `/config …` | Configurator | Server settings |
| `/whitelist …` | Configurator | Access lists |
| `/kick` `/ban` `/mute` `/unmute` `/clear` | Staff | Moderation |
| `/say` `/embed` | Admin | Messaging |
| `/giveaway start` `end` `list` | Admin | Timed giveaways with random winners |

## Data storage

The bot stores **guild config**, **open tickets**, **licenses**, and **ticket cooldowns**.

| Mode | When | Where |
|------|------|--------|
| **PostgreSQL** | `DATABASE_URL` is set (recommended on Render) | Render Postgres — survives redeploys |
| **JSON files** | `DATABASE_URL` unset (local dev) | `data/*.json` — back up when moving servers |

On first boot with an empty database, existing `data/*.json` files are imported automatically once.

### Render + PostgreSQL setup

1. **Create Postgres** — Render Dashboard → **New +** → **PostgreSQL**. Pick a name and region (same as the bot if possible).
2. **Copy connection URL** — Open the database → **Connect** → **Internal Database URL** (use this for bot and DB in the same Render account).
3. **Attach to the bot** — Your **Web Service** → **Environment** → add:
   - `DATABASE_URL` = Internal Database URL from step 2
   - Keep `DISCORD_TOKEN`, `CLIENT_ID`, `GUILD_ID` as before
4. **Deploy** — Push code or **Manual Deploy**. Check logs for `Storage: PostgreSQL` or `migrated from data/*.json`.
5. **UptimeRobot** — Keep pinging `https://your-app.onrender.com/health` (unchanged).

**Start command:** `npm start` · **Build:** `npm install`

If you already had live data only in `data/*.json` on the server disk, upload or paste that data into `data/` before the first Postgres deploy, or export from a backup — the one-time import runs only when the database is empty.

### What is not in the database

Payment proofs, chat history, and Discord channels/roles (only IDs are stored). Secrets stay in environment variables.

## Security notes

- Never commit `.env` or your bot token.
- Only trusted roles should have `config` or `admin` whitelist entries.
- Payment details are visible only inside private ticket channels.

## License

MIT
