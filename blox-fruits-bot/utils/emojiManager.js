const allFruits = require('../data/fruits.json');

const cache = new Map();
let ready = false;

function twemojiUrl(emoji) {
  const codepoints = [...emoji]
    .map(ch => ch.codePointAt(0).toString(16))
    .join('-');
  return `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/${codepoints}.png`;
}

function emojiName(fruitName) {
  return ('bf_' + fruitName.toLowerCase().replace(/[^a-z0-9]/g, '_')).slice(0, 32);
}

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

  if (!guild.members.me?.permissions.has('ManageGuildExpressions')) {
    console.warn('[EMOJI] Missing ManageGuildExpressions on home guild — using Unicode fallback.');
    allFruits.forEach(f => cache.set(f.name, f.emoji));
    ready = true;
    return;
  }

  await guild.emojis.fetch();
  const existing = guild.emojis.cache;

  let created = 0;
  let reused  = 0;
  let failed  = 0;

  for (const fruit of allFruits) {
    const name = emojiName(fruit.name);

    const found = existing.find(e => e.name === name);
    if (found) {
      cache.set(fruit.name, `<:${found.name}:${found.id}>`);
      reused++;
      continue;
    }

    const usedSlots = guild.emojis.cache.filter(e => !e.animated).size;
    if (usedSlots >= 50) {
      console.warn(`[EMOJI] Home guild emoji slots full — falling back for ${fruit.name}`);
      cache.set(fruit.name, fruit.emoji);
      failed++;
      continue;
    }

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

function getFruitEmoji(fruitName) {
  return cache.get(fruitName)
    ?? allFruits.find(f => f.name === fruitName)?.emoji
    ?? '🍎';
}

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
