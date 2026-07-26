# Flake

A modular, self-hostable Discord bot built around cryptocurrency utilities. Flake provides live price tracking, on-chain balance lookups, transaction inspection, and payment profile management — all served through a clean Discord.js v14 interface with Components V2 UI.

---

## Features

- Live market prices with 24-hour change and auto-generated price charts for 30+ cryptocurrencies
- On-chain wallet balance lookups with recent transaction history across multiple networks
- Transaction inspection by hash with amount, fee, confirmations, and explorer links
- Per-user payment profile system supporting crypto addresses, UPI IDs, and PayPal usernames
- Prefix and slash command support running side by side
- Configurable per-guild prefix via modal input
- In-memory caching with configurable size limits
- Graceful shutdown handling with cleanup hooks
- Developer blacklist system for users and guilds
- Modular event and command loader with hot-reload support

---

## Supported Networks

| Name           | Symbol | Type   |
| -------------- | ------ | ------ |
| Bitcoin        | BTC    | UTXO   |
| Ethereum       | ETH    | EVM    |
| Litecoin       | LTC    | UTXO   |
| Bitcoin Cash   | BCH    | UTXO   |
| Dogecoin       | DOGE   | UTXO   |
| Zcash          | ZEC    | UTXO   |
| Dash           | DASH   | UTXO   |
| XRP            | XRP    | XRP    |
| Stellar        | XLM    | XLM    |
| Tron           | TRX    | Tron   |
| Solana         | SOL    | EVM    |
| BNB Chain      | BNB    | EVM    |
| Polygon        | POL    | EVM    |
| Avalanche      | AVAX   | EVM    |
| Arbitrum       | ARB    | EVM    |
| Optimism       | OP     | EVM    |
| Cardano        | ADA    | —      |
| Monero         | XMR    | —      |
| Polkadot       | DOT    | —      |
| And more...    |        |        |

---

## Commands

### General

| Command   | Description                                      |
| --------- | ------------------------------------------------ |
| `ping`    | Display WebSocket and API latency                |
| `help`    | Browse all available commands                    |
| `stats`   | View bot statistics and uptime                   |
| `invite`  | Get the bot invite link and app install link     |
| `support` | Get a link to the support server                 |

### Crypto

| Command        | Description                                                    |
| -------------- | -------------------------------------------------------------- |
| `price`        | Get the live USD price and 24h change for any supported coin   |
| `bal`          | Look up the balance and recent transactions of any wallet      |
| `mybal`        | Look up the balance of your own saved wallet address           |
| `tx`           | Inspect a transaction by hash on any supported network         |

### Profile

| Command         | Description                                      |
| --------------- | ------------------------------------------------ |
| `profile`       | View your full payment profile                   |
| `addy`          | View a saved crypto address for a given coin     |
| `setaddy`       | Save a crypto address to your profile            |
| `removeaddy`    | Remove a saved crypto address from your profile  |
| `upi`           | View your saved UPI ID                           |
| `setupi`        | Save a UPI ID to your profile                    |
| `removeupi`     | Remove your saved UPI ID                         |
| `paypal`        | View your saved PayPal username                  |
| `setpaypal`     | Save a PayPal username to your profile           |
| `removepaypal`  | Remove your saved PayPal username                |

### Configuration

| Command  | Description                    |
| -------- | ------------------------------ |
| `prefix` | View or change the guild prefix |

### Developer

| Command     | Description                                           |
| ----------- | ----------------------------------------------------- |
| `blacklist` | Add, remove, check, or list blacklisted users/guilds  |

---

## Prerequisites

- Node.js 18 or higher
- A MongoDB instance (local or Atlas)
- A [Tatum](https://tatum.io) API key for blockchain data
- A Discord bot token with the Message Content intent enabled

---

## Setup

**1. Clone the repository**

```bash
git clone https://github.com/itsfizys/Flake.git
cd Flake
```

**2. Install dependencies**

```bash
npm install
```

**3. Configure environment variables**

Create a `.env` file in the root directory:

```env
TOKEN=your_discord_bot_token
CLIENT_ID=your_discord_client_id
OWNER_IDS=your_discord_user_id
MONGODB_URI=your_mongodb_connection_string
TATUM_API_KEY=your_tatum_api_key
```

| Variable       | Required | Description                                        |
| -------------- | -------- | -------------------------------------------------- |
| `TOKEN`        | Yes      | Your Discord bot token                             |
| `CLIENT_ID`    | Yes      | Your Discord application client ID                 |
| `OWNER_IDS`    | Yes      | Comma-separated owner user IDs                     |
| `MONGODB_URI`  | Yes      | MongoDB connection string                          |
| `TATUM_API_KEY`| Yes      | Tatum API key for on-chain balance and tx lookups  |

**4. Register slash commands**

Slash commands are registered automatically on bot startup.

**5. Start the bot**

```bash
npm start
```

---

## File Structure

```
Flake/
├── src/
│   ├── bot.js                          # Entry point, shutdown handling
│   ├── assets/
│   │   ├── help_banner.png             # Banner image for the help command
│   │   └── qr_frame2.jpg              # QR code frame asset
│   ├── commands/
│   │   ├── dev/
│   │   │   └── blacklist.js           # Developer blacklist management
│   │   └── meta/
│   │       ├── config/
│   │       │   └── prefix.js          # Guild prefix configuration
│   │       ├── addy.js                # View saved crypto address
│   │       ├── bal.js                 # Wallet balance lookup
│   │       ├── help.js                # Help menu
│   │       ├── invite.js              # Bot invite links
│   │       ├── mybal.js               # Personal wallet balance
│   │       ├── paypal.js              # View saved PayPal
│   │       ├── ping.js                # Latency check
│   │       ├── price.js               # Live crypto price with chart
│   │       ├── profile.js             # Full user payment profile
│   │       ├── removeaddy.js          # Remove saved address
│   │       ├── removepaypal.js        # Remove saved PayPal
│   │       ├── removeupi.js           # Remove saved UPI
│   │       ├── setaddy.js             # Save crypto address
│   │       ├── setpaypal.js           # Save PayPal username
│   │       ├── setupi.js              # Save UPI ID
│   │       ├── stats.js               # Bot statistics
│   │       ├── support.js             # Support server link
│   │       ├── tx.js                  # Transaction lookup
│   │       └── upi.js                 # View saved UPI
│   ├── config/
│   │   ├── config.js                  # Bot configuration and environment
│   │   └── emoji.js                   # Custom emoji definitions
│   ├── database/
│   │   ├── manager.js                 # Database manager (aggregates all services)
│   │   ├── mongo.js                   # MongoDB connection handler
│   │   ├── repositories/
│   │   │   ├── blacklist.js           # Blacklist data access
│   │   │   ├── guilds.js              # Guild data access
│   │   │   └── users.js               # User data access
│   │   ├── schema/
│   │   │   ├── blacklist.js           # Blacklist Mongoose schema
│   │   │   ├── guilds.js              # Guild Mongoose schema
│   │   │   ├── index.js               # Schema exports
│   │   │   └── users.js               # User Mongoose schema
│   │   └── services/
│   │       ├── blacklist.js           # Blacklist business logic
│   │       ├── guilds.js              # Guild business logic
│   │       └── users.js               # User business logic
│   ├── events/
│   │   └── discord/
│   │       ├── clientReady.js         # Ready event, presence rotation
│   │       └── guild/
│   │           ├── Prefixcmd.js       # Prefix command handler
│   │           └── slashcmd.js        # Slash command handler
│   ├── structures/
│   │   ├── classes/
│   │   │   ├── cache.js               # In-memory cache implementation
│   │   │   ├── client.js              # Extended Discord.js Client (Bot class)
│   │   │   ├── command.js             # Base Command class
│   │   │   ├── context.js             # Unified command context (prefix + slash)
│   │   │   └── rei.js                 # Utility class
│   │   └── handlers/
│   │       ├── commandHandler.js      # Command registration and execution
│   │       ├── eventLoader.js         # Dynamic event loader
│   │       └── event-handlers/
│   │           └── discord.js         # Discord event handler bootstrap
│   └── utils/
│       ├── chainConfig.js             # Supported chain definitions and aliases
│       ├── chart.js                   # Price chart generator (canvas)
│       ├── common.js                  # Shared utility functions
│       ├── disableComponents.js       # Discord component disabling helper
│       ├── formatters.js              # Number, address, and value formatters
│       ├── index.js                   # Utility barrel export
│       ├── logger.js                  # Styled console logger
│       ├── permissionHandler.js       # Discord permission checks
│       ├── price.js                   # Tatum price fetching
│       └── tatum.js                   # Tatum API client wrapper
├── .gitignore
└── package.json
```

---

## Credits

Developed by **[itsfizys](https://github.com/itsfizys)**.

---

## Support

Join the **AeroX Development** server for help, updates, and feedback.

**https://discord.gg/aerox**

---

## License

Custom
