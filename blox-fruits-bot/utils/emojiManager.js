/**
 * Emoji Manager
 * Converts fruit Unicode emojis → Twemoji PNG images → Discord custom guild emojis.
 * All custom emojis are stored on the bot's home guild (GUILD_ID) and reused everywhere.
 * Falls back to the original Unicode emoji if creation fails.
 */

const allFruits = require('../data/fruits.json');

/** emoji name → "<:name:id>" or fallback Unicode string */
const cache = new Map();
let ready = false;

/**
 * Build the jsDelivr Twemoji PNG URL from a Unicode emoji string.
 * Uses codepoints joined by hyphens (including fe0f variation selectors).
 */
function twemojiUrl(emoji) {
  const codepoints = [...emoji]
    .map(ch => ch.codePointAt(0).toString(16))
    .join('-');
  return `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/${codepoints}.png`;
}

/** Normalise a fruit name into a valid Discord emoji name (2-32 alnum/_). */
function emojiName(fruitName) {
  return ('bf_' + fruitName.toLowerCase().replace(/[^a-z0-9]/g, '_')).slice(0, 32);
}

/**
 * Initialise all fruit emojis on the home guild at startup.
 * Call once from the ClientReady event.
 */
async function initFruitEmojis(client) {
  const guildId = process.env.GUILD_ID;
  if (!guildId) {
    console.warn('[EMOJI] GUILD_ID not set — using Unicode emoji fallback for all fruits.');
    allFruits.forEach(f => cache.set(f.name, f.emoji));
    ready = true;
    return;
  }

  let guild;
  try {
    guild = await client.guilds.fetch(guildId);
  } catch {
    console.warn('[EMOJI] Could not fetch home guild — using Unicode fallback.');
    allFruits.forEach(f => cache.set(f.name, f.emoji));
    ready = true;
    return;
  }

  // Check ManageEmojis permission
  if (!guild.members.me?.permissions.has('ManageGuildExpressions')) {
    console.warn('[EMOJI] Missing ManageGuildExpressions on home guild — using Unicode fallback.');
    allFruits.forEach(f => cache.set(f.name, f.emoji));
    ready = true;
    return;
  }

  // Fetch existing emojis
  await guild.emojis.fetch();
  const existing = guild.emojis.cache;

  let created = 0;
  let reused  = 0;
  let failed  = 0;

  for (const fruit of allFruits) {
    const name = emojiName(fruit.name);

    // Already created in a previous run
    const found = existing.find(e => e.name === name);
    if (found) {
      cache.set(fruit.name, `<:${found.name}:${found.id}>`);
      reused++;
      continue;
    }

    // Check available slots (free servers: 50; ignore animated)
    const usedSlots = guild.emojis.cache.filter(e => !e.animated).size;
    if (usedSlots >= 50) {
      console.warn(`[EMOJI] Home guild emoji slots full — falling back for ${fruit.name}`);
      cache.set(fruit.name, fruit.emoji);
      failed++;
      continue;
    }

    // Upload the Twemoji PNG
    try {
      const url     = twemojiUrl(fruit.emoji);
      const created_emoji = await guild.emojis.create({
        name,
        attachment: url,
        reason: 'Blox Fruits Stock Bot — fruit icon',
      });
      cache.set(fruit.name, `<:${created_emoji.name}:${created_emoji.id}>`);
      created++;
    } catch (err) {
      console.warn(`[EMOJI] Failed to create ${fruit.name}:`, err.message);
      cache.set(fruit.name, fruit.emoji);
      failed++;
    }
  }

  ready = true;
  console.log(`[EMOJI] ✅ ${reused} reused  🆕 ${created} created  ⚠️ ${failed} fallback`);
}

/**
 * Get the display emoji for a fruit.
 * Returns "<:bf_dragon:123456>" when custom emoji is ready, or Unicode fallback.
 */
function getFruitEmoji(fruitName) {
  return cache.get(fruitName)
    ?? allFruits.find(f => f.name === fruitName)?.emoji
    ?? '🍎';
}

/**
 * Get emoji in the format Discord select-menu options expect.
 * Returns { id, name } for custom emoji or a plain Unicode string.
 */
function getSelectEmoji(fruitName) {
  const e = cache.get(fruitName);
  if (e && e.startsWith('<:')) {
    const [, name, id] = e.match(/^<:([^:]+):(\d+)>$/);
    return { id, name };
  }
  const fruit = allFruits.find(f => f.name === fruitName);
  return fruit?.emoji ?? '🍎';
}

module.exports = { initFruitEmojis, getFruitEmoji, getSelectEmoji, isReady: () => ready };
