require('dotenv').config();

const { Client, GatewayIntentBits, Collection, Events } = require('discord.js');
const fs   = require('fs');
const path = require('path');

// ── Validate env ──────────────────────────────────────────────────────────────
if (!process.env.TOKEN) {
  console.error('[ERROR] Missing TOKEN in .env — copy .env.example to .env and fill it in.');
  process.exit(1);
}

// ── Create client ─────────────────────────────────────────────────────────────
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.commands = new Collection();

// ── Load commands ─────────────────────────────────────────────────────────────
const commandsPath = path.join(__dirname, 'commands');
for (const file of fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'))) {
  const command = require(path.join(commandsPath, file));
  if (command.data && command.execute) {
    client.commands.set(command.data.name, command);
    console.log(`[CMD] Loaded /${command.data.name}`);
  } else {
    console.warn(`[WARN] Skipping ${file} — missing "data" or "execute".`);
  }
}

// ── Load events ───────────────────────────────────────────────────────────────
const eventsPath = path.join(__dirname, 'events');
if (fs.existsSync(eventsPath)) {
  for (const file of fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'))) {
    const event = require(path.join(eventsPath, file));
    const handler = (...args) => event.execute(...args, client);
    event.once
      ? client.once(event.name, handler)
      : client.on(event.name, handler);
    console.log(`[EVT] Loaded ${event.name}`);
  }
}

// ── Ready ─────────────────────────────────────────────────────────────────────
client.once(Events.ClientReady, c => {
  console.log(`\n✅ Logged in as ${c.user.tag}`);
  console.log(`📦 Commands: ${client.commands.size} | Events: ${fs.existsSync(eventsPath) ? fs.readdirSync(eventsPath).filter(f => f.endsWith('.js')).length : 0}`);
  c.user.setActivity('🍎 Tracking Blox Fruits Stock', { type: 3 });
});

// ── Slash command interactions ────────────────────────────────────────────────
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(`[ERROR] /${interaction.commandName}:`, err);
    const msg = { content: '❌ Something went wrong running this command.', ephemeral: true };
    interaction.replied || interaction.deferred
      ? await interaction.followUp(msg)
      : await interaction.reply(msg);
  }
});

// ── Login ─────────────────────────────────────────────────────────────────────
client.login(process.env.TOKEN);
