require('dotenv').config();

const { Client, GatewayIntentBits, Collection, Events } = require('discord.js');
const fs   = require('fs');
const path = require('path');

if (!process.env.TOKEN) {
  console.error('[ERROR] Missing TOKEN in .env');
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.commands = new Collection();

// ── Load commands ─────────────────────────────────────────────────────────────
const commandsPath = path.join(__dirname, 'commands');
for (const file of fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'))) {
  const cmd = require(path.join(commandsPath, file));
  if (cmd.data && cmd.execute) {
    client.commands.set(cmd.data.name, cmd);
    console.log(`[CMD] Loaded /${cmd.data.name}`);
  }
}

// ── Load events ───────────────────────────────────────────────────────────────
const eventsPath = path.join(__dirname, 'events');
if (fs.existsSync(eventsPath)) {
  for (const file of fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'))) {
    const event = require(path.join(eventsPath, file));
    const handler = (...args) => event.execute(...args, client);
    event.once ? client.once(event.name, handler) : client.on(event.name, handler);
    console.log(`[EVT] Loaded ${event.name}`);
  }
}

// ── Ready ─────────────────────────────────────────────────────────────────────
client.once(Events.ClientReady, async c => {
  console.log(`\n✅ Logged in as ${c.user.tag}`);
  console.log(`📦 Commands: ${client.commands.size}`);
  c.user.setActivity('🍎 Tracking Blox Fruits Stock', { type: 3 });

  // Upload all fruit images as custom emojis to the home guild
  const { initFruitEmojis } = require('./utils/emojiManager');
  await initFruitEmojis(c);
});

// ── Slash commands ────────────────────────────────────────────────────────────
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const command = client.commands.get(interaction.commandName);
  if (!command) return;
  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(`[ERROR] /${interaction.commandName}:`, err);
    const msg = { content: '❌ Something went wrong.', ephemeral: true };
    interaction.replied || interaction.deferred
      ? await interaction.followUp(msg)
      : await interaction.reply(msg);
  }
});

client.login(process.env.TOKEN);
