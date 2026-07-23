require('dotenv').config();

const { Client, GatewayIntentBits, Collection, Events } = require('discord.js');
const fs   = require('fs');
const path = require('path');

if (!process.env.TOKEN) {
  console.error('[ERROR] Missing TOKEN in .env');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});
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

  // Start automatic stock polling (every 30 minutes)
  startStockPolling(c);
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

// ── Auto-stock polling ────────────────────────────────────────────────────────
const POLL_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
let lastNormalStock = '';
let lastMirageStock = '';

function stockKey(fruits) {
  return fruits.map(f => f.name).sort().join(',');
}

async function pollStock(client) {
  const { fetchLiveStock, applyLiveStock } = require('./utils/stockFetcher');
  const { getConfig } = require('./utils/configManager');
  const { getStock }  = require('./utils/stockManager');
  const { getFruitEmoji } = require('./utils/emojiManager');
  const { EmbedBuilder } = require('discord.js');

  try {
    const live = await fetchLiveStock();
    if (!live) return;

    const newNormal = stockKey(live.normal);
    const newMirage = stockKey(live.mirage);

    const normalChanged = newNormal !== lastNormalStock;
    const mirageChanged = newMirage !== lastMirageStock;

    if (!normalChanged && !mirageChanged) {
      console.log('[STOCK] No change detected');
      return;
    }

    if (normalChanged) lastNormalStock = newNormal;
    if (mirageChanged) lastMirageStock = newMirage;

    console.log(`[STOCK] Change detected — Normal: ${normalChanged}, Mirage: ${mirageChanged}`);

    // Update every guild that has a stock channel configured
    for (const guild of client.guilds.cache.values()) {
      try {
        const cfg = getConfig(guild.id);
        applyLiveStock(guild.id, live);

        if (!cfg.stockChannelId) continue;
        const channel = guild.channels.cache.get(cfg.stockChannelId);
        if (!channel) continue;

        function formatLines(fruits) {
          const inStock = fruits.filter(f => f.inStock);
          if (!inStock.length) return '_None in stock right now._';
          return inStock
            .map(f => `${getFruitEmoji(f.name)} **${f.name}** *(${f.type})*\n　💰 $${f.price.toLocaleString()} | 💎 R$${f.robuxPrice.toLocaleString()}`)
            .join('\n\n');
        }

        const updated = getStock(guild.id);
        const tags = [];
        if (normalChanged) tags.push('🌍 Normal dealer rotated');
        if (mirageChanged) tags.push('🌙 Mirage dealer rotated');

        const embed = new EmbedBuilder()
          .setTitle('🔄 Blox Fruits Stock Update')
          .setColor(0xFFA500)
          .setDescription(`> ${tags.join(' • ')}`)
          .addFields(
            { name: '🌍 Normal Stock', value: formatLines(updated.normal), inline: false },
            { name: '\u200B',          value: '\u200B',                    inline: false },
            { name: '🌙 Mirage Stock', value: formatLines(updated.mirage), inline: false },
          )
          .setFooter({ text: 'Auto-fetched from fruityblox.com' })
          .setTimestamp();

        await channel.send({ embeds: [embed] });
        console.log(`[STOCK] Posted update to ${guild.name} → #${channel.name}`);
      } catch (gErr) {
        console.warn(`[STOCK] Error updating ${guild.name}:`, gErr.message);
      }
    }
  } catch (err) {
    console.error('[STOCK] Poll error:', err.message);
  }
}

function startStockPolling(client) {
  // Run once after 10 seconds, then every 30 minutes
  setTimeout(() => {
    pollStock(client);
    setInterval(() => pollStock(client), POLL_INTERVAL_MS);
  }, 10_000);
  console.log('[STOCK] Auto-polling started — checks every 30 minutes');
}

// ── Keep-alive HTTP server ────────────────────────────────────────────────────
const { startKeepAlive } = require('./utils/keepAlive');
startKeepAlive();

client.login(process.env.TOKEN);
