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

  // Emoji init
  const { initFruitEmojis } = require('./utils/emojiManager');
  await initFruitEmojis(c);

  // Pull live stock immediately, then every 30 minutes
  await runStockPoll(c);
  setInterval(() => runStockPoll(c), 30 * 60 * 1000);
  console.log('[STOCK] Auto-polling every 30 minutes');
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

// ── Stock polling ─────────────────────────────────────────────────────────────
let lastNormalKey = '';
let lastMirageKey = '';

function stockKey(arr) {
  return arr.map(f => f.name).sort().join(',');
}

async function runStockPoll(client) {
  const { fetchLiveStock, applyLiveStock } = require('./utils/stockFetcher');
  const { getConfig }   = require('./utils/configManager');
  const { getStock }    = require('./utils/stockManager');
  const { getFruitEmoji } = require('./utils/emojiManager');
  const { EmbedBuilder } = require('discord.js');

  try {
    const live = await fetchLiveStock();
    if (!live) {
      console.warn('[STOCK] Poll returned no data — will retry next interval');
      return;
    }

    const newNormal = stockKey(live.normal);
    const newMirage = stockKey(live.mirage);
    const normalChanged = newNormal !== lastNormalKey;
    const mirageChanged = newMirage !== lastMirageKey;

    // Always apply to every guild regardless of whether it changed
    // (ensures guilds that just started up are synced)
    const firstRun = !lastNormalKey && !lastMirageKey;

    if (!normalChanged && !mirageChanged && !firstRun) {
      console.log('[STOCK] No change — stock is current');
      return;
    }

    lastNormalKey = newNormal;
    lastMirageKey = newMirage;

    const tags = [];
    if (firstRun)      tags.push('🔄 Initial sync');
    if (normalChanged && !firstRun) tags.push('🌍 Normal dealer rotated');
    if (mirageChanged && !firstRun) tags.push('🌙 Mirage dealer rotated');

    console.log(`[STOCK] ${tags.join(' | ')} — Normal: [${live.normal.map(f => f.name).join(', ')}] | Mirage: [${live.mirage.map(f => f.name).join(', ')}]`);

    function buildLines(fruits) {
      const inStock = fruits.filter(f => f.inStock);
      if (!inStock.length) return '_None in stock._';
      return inStock
        .map(f => `${getFruitEmoji(f.name)} **${f.name}** *(${f.type})*\n　💰 $${f.price.toLocaleString()} | 💎 R$${f.robuxPrice.toLocaleString()}`)
        .join('\n\n');
    }

    // Apply to every guild and post to stock channel if configured
    for (const guild of client.guilds.cache.values()) {
      try {
        applyLiveStock(guild.id, live);

        // Only post announcement if stock changed (not on first run silent sync)
        if (firstRun) continue;

        const cfg = getConfig(guild.id);
        if (!cfg.stockChannelId) continue;

        const channel = guild.channels.cache.get(cfg.stockChannelId);
        if (!channel) continue;

        const updated = getStock(guild.id);

        const embed = new EmbedBuilder()
          .setTitle('🔄 Blox Fruits Stock Update')
          .setColor(0xFFA500)
          .setDescription(`> ${tags.join(' • ')}`)
          .addFields(
            { name: '🌍 Normal Stock', value: buildLines(updated.normal), inline: false },
            { name: '\u200B',          value: '\u200B',                   inline: false },
            { name: '🌙 Mirage Stock', value: buildLines(updated.mirage), inline: false },
          )
          .setFooter({ text: 'Auto-synced from fruityblox.com • /stock to view anytime' })
          .setTimestamp();

        await channel.send({ embeds: [embed] });
        console.log(`[STOCK] Posted update → ${guild.name} #${channel.name}`);
      } catch (gErr) {
        console.warn(`[STOCK] ${guild.name}:`, gErr.message);
      }
    }
  } catch (err) {
    console.error('[STOCK] Poll error:', err.message);
  }
}

// ── Keep-alive HTTP server ────────────────────────────────────────────────────
const { startKeepAlive } = require('./utils/keepAlive');
startKeepAlive();

client.login(process.env.TOKEN);
