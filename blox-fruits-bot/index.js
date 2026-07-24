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

  const { initFruitEmojis } = require('./utils/emojiManager');
  await initFruitEmojis(c);

  // Fetch all guilds into cache before first poll
  try {
    await c.guilds.fetch();
    console.log(`[STOCK] Bot is in ${c.guilds.cache.size} guild(s)`);
  } catch (e) {
    console.warn('[STOCK] Could not pre-fetch guilds:', e.message);
  }

  // Run immediately, then every 30 minutes
  await runStockPoll(c);
  setInterval(() => runStockPoll(c), 30 * 60 * 1000);
  console.log('[STOCK] Auto-polling every 30 minutes ✅');
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

/** Returns all guild IDs the bot knows about:
 *  - every guild in client.guilds.cache
 *  - every folder that already exists in data/guilds/ (offline or evicted guilds)
 */
function allKnownGuildIds(client) {
  const ids = new Set(client.guilds.cache.keys());
  const guildsDir = path.join(__dirname, 'data', 'guilds');
  if (fs.existsSync(guildsDir)) {
    for (const entry of fs.readdirSync(guildsDir, { withFileTypes: true })) {
      if (entry.isDirectory()) ids.add(entry.name);
    }
  }
  return [...ids];
}

async function runStockPoll(client) {
  const { fetchLiveStock, applyLiveStock } = require('./utils/stockFetcher');
  const { getConfig }     = require('./utils/configManager');
  const { getStock }      = require('./utils/stockManager');
  const { getFruitEmoji } = require('./utils/emojiManager');
  const { EmbedBuilder }  = require('discord.js');

  try {
    const live = await fetchLiveStock();
    if (!live) {
      console.warn('[STOCK] Fetch returned nothing — will retry next cycle');
      return;
    }

    const newNormalKey = stockKey(live.normal);
    const newMirageKey = stockKey(live.mirage);
    const firstRun     = lastNormalKey === '' && lastMirageKey === '';
    const normalChanged = newNormalKey !== lastNormalKey;
    const mirageChanged = newMirageKey !== lastMirageKey;

    if (!firstRun && !normalChanged && !mirageChanged) {
      console.log('[STOCK] No change detected — stock matches last check');
      return;
    }

    // Capture which fruits were in stock BEFORE the update (for ping logic)
    const previousNormalNames = new Set(lastNormalKey ? lastNormalKey.split(',') : []);
    const previousMirageNames = new Set(lastMirageKey ? lastMirageKey.split(',') : []);

    lastNormalKey = newNormalKey;
    lastMirageKey = newMirageKey;

    // Fruits that are NEW in stock this cycle (weren't in stock before)
    const newNormalFruits = live.normal.filter(f => !previousNormalNames.has(f.name));
    const newMirageFruits = live.mirage.filter(f => !previousMirageNames.has(f.name));

    // Collect ALL known guild IDs (cache + disk)
    const guildIds = allKnownGuildIds(client);
    console.log(`[STOCK] ${firstRun ? 'Initial sync' : 'Change detected'} — applying to ${guildIds.length} guild(s)`);
    console.log(`[STOCK] Normal: [${live.normal.map(f => f.name).join(', ')}]`);
    console.log(`[STOCK] Mirage: [${live.mirage.map(f => f.name).join(', ')}]`);
    if (!firstRun && (newNormalFruits.length || newMirageFruits.length)) {
      console.log(`[STOCK] New in stock — Normal: [${newNormalFruits.map(f => f.name).join(', ')}] Mirage: [${newMirageFruits.map(f => f.name).join(', ')}]`);
    }

    function buildLines(fruits) {
      const inStock = fruits.filter(f => f.inStock);
      if (!inStock.length) return '_None in stock right now._';
      return inStock
        .map(f =>
          `${getFruitEmoji(f.name)} **${f.name}** *(${f.type})*\n　💰 $${f.price.toLocaleString()} | 💎 R$${f.robuxPrice.toLocaleString()}`
        )
        .join('\n\n');
    }

    for (const guildId of guildIds) {
      try {
        // Apply live stock to disk — works for every guild ID, even if not in cache
        applyLiveStock(guildId, live);
        console.log(`[STOCK] ✅ Applied to guild ${guildId}`);

        // Only post a Discord announcement if stock actually changed (not first-run silent sync)
        if (firstRun) continue;

        const guild = client.guilds.cache.get(guildId);
        if (!guild) continue; // guild is offline or evicted from cache

        const cfg = getConfig(guildId);
        if (!cfg.stockChannelId) continue;

        const channel = guild.channels.cache.get(cfg.stockChannelId);
        if (!channel) continue;

        const tags = [];
        if (normalChanged) tags.push('🌍 Normal dealer rotated');
        if (mirageChanged) tags.push('🌙 Mirage dealer rotated');

        const updated = getStock(guildId);

        // ── Build ping mentions for newly-in-stock fruits ────────────────────
        const pingMentions = [];
        if (!firstRun && (newNormalFruits.length || newMirageFruits.length)) {
          const { ensureStockRole } = require('./utils/roleManager');
          const allNewFruits = [...newNormalFruits, ...newMirageFruits];
          for (const fruit of allNewFruits) {
            try {
              const role = await ensureStockRole(guild, fruit.name);
              if (role) pingMentions.push(role.toString());
            } catch (e) {
              console.warn(`[STOCK] Could not ensure role for ${fruit.name}:`, e.message);
            }
          }
        }

        const embed = new EmbedBuilder()
          .setTitle('🔄 Blox Fruits Stock Update')
          .setColor(0xFFA500)
          .setDescription(`> ${tags.join(' • ')}`)
          .addFields(
            { name: '🌍 Normal Stock', value: buildLines(updated.normal), inline: false },
            { name: '\u200B',          value: '\u200B',                   inline: false },
            { name: '🌙 Mirage Stock', value: buildLines(updated.mirage), inline: false },
          )
          .setFooter({ text: 'Auto-synced from fruityblox.com • /stock to view anytime • /fruitping to get notified' })
          .setTimestamp();

        const content = pingMentions.length
          ? `🔔 **New fruit in stock!** ${pingMentions.join(' ')}`
          : '';

        await channel.send({ content: content || undefined, embeds: [embed], allowedMentions: { roles: pingMentions.map(m => m.match(/\d+/)?.[0]).filter(Boolean) } });
        console.log(`[STOCK] 📢 Posted to ${guild.name} → #${channel.name}${pingMentions.length ? ` (pinged ${pingMentions.length} role(s))` : ''}`);
      } catch (gErr) {
        console.warn(`[STOCK] Guild ${guildId} error:`, gErr.message);
      }
    }
  } catch (err) {
    console.error('[STOCK] Poll crashed:', err.message);
  }
}

// ── Keep-alive HTTP server ────────────────────────────────────────────────────
const { startKeepAlive } = require('./utils/keepAlive');
startKeepAlive();

client.login(process.env.TOKEN);
