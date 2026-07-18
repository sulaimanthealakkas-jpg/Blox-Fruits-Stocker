require('dotenv').config();

const { Client, GatewayIntentBits, Events } = require('discord.js');
const { loadCommands, handleInteraction } = require('./handlers/commandHandler');

// ─── Validate environment variables ───────────────────────────────────────────
const { TOKEN } = process.env;

if (!TOKEN) {
  console.error('[ERROR] Missing TOKEN in .env — copy .env.example to .env and fill it in.');
  process.exit(1);
}

// ─── Create Discord client ─────────────────────────────────────────────────────
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

// ─── Load commands ─────────────────────────────────────────────────────────────
loadCommands(client);

// ─── Event: Ready ─────────────────────────────────────────────────────────────
client.once(Events.ClientReady, (c) => {
  console.log(`\n✅ Logged in as ${c.user.tag}`);
  console.log(`📦 Loaded ${client.commands.size} command(s)`);
  console.log(`🌐 Serving ${c.guilds.cache.size} guild(s)\n`);

  // Set a rich presence so the bot looks active in Discord
  c.user.setActivity('🍎 Tracking Blox Fruits Stock', { type: 3 }); // 3 = Watching
});

// ─── Event: Interaction ───────────────────────────────────────────────────────
client.on(Events.InteractionCreate, handleInteraction);

// ─── Event: Error handling ────────────────────────────────────────────────────
client.on(Events.Error, (error) => {
  console.error('[CLIENT ERROR]', error);
});

process.on('unhandledRejection', (error) => {
  console.error('[UNHANDLED REJECTION]', error);
});

// ─── Login ────────────────────────────────────────────────────────────────────
client.login(TOKEN);
