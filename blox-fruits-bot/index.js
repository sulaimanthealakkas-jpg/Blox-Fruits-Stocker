require('dotenv').config();

const { Client, GatewayIntentBits, Collection, Events } = require('discord.js');
const fs = require('fs');
const path = require('path');

// ── Validate env ──────────────────────────────────────────────────────────────
if (!process.env.TOKEN) {
  console.error('[ERROR] Missing TOKEN in .env — copy .env.example to .env and fill it in.');
  process.exit(1);
}

// ── Create client ─────────────────────────────────────────────────────────────
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.commands = new Collection();

// ── Load commands from /commands ──────────────────────────────────────────────
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  if (command.data && command.execute) {
    client.commands.set(command.data.name, command);
    console.log(`[CMD] Loaded /${command.data.name}`);
  } else {
    console.warn(`[WARN] Skipping ${file} — missing "data" or "execute".`);
  }
}

// ── Ready ─────────────────────────────────────────────────────────────────────
client.once(Events.ClientReady, c => {
  console.log(`\n✅ Logged in as ${c.user.tag}`);
  console.log(`📦 Commands loaded: ${client.commands.size}`);
  c.user.setActivity('🍎 Tracking Blox Fruits Stock', { type: 3 }); // Watching
});

// ── Handle slash commands ─────────────────────────────────────────────────────
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
