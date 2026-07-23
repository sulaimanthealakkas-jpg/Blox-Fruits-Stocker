/**
 * Fetches real Blox Fruits stock from fruityblox.com.
 * Uses the Next.js RSC endpoint which returns the live stock as embedded JSON.
 *
 * Confirmed working regex: /"normal":\[.*\],"mirage":\[.*\]/
 */

const allFruits = require('../data/fruits.json');
const { getStock, saveStock } = require('./stockManager');

const FETCH_URL = 'https://fruityblox.com/stock';
const HEADERS   = {
  'User-Agent': 'Mozilla/5.0 (compatible; BloxStockBot/2.0)',
  'RSC': '1',
  'Next-Router-State-Tree':
    '%5B%22%22%2C%7B%22children%22%3A%5B%22stock%22%2C%7B%22children%22%3A%5B%22__PAGE__%22%2C%7B%7D%5D%7D%5D%7D%2Cnull%2Cnull%2Ctrue%5D',
  'Accept': 'text/x-component',
};

/** Find our local fruit record by name (case-insensitive). */
function localFruit(name) {
  const lower = name.toLowerCase();
  return allFruits.find(f => f.name.toLowerCase() === lower);
}

/**
 * Fetch the current stock from fruityblox.com.
 * Returns { normal: FruitEntry[], mirage: FruitEntry[] } or null on failure.
 * Each FruitEntry: { name, type, price, robuxPrice, rarity, emoji, inStock: true }
 */
async function fetchLiveStock() {
  let text;
  try {
    const res = await fetch(FETCH_URL, { headers: HEADERS });
    if (!res.ok) {
      console.warn(`[STOCK] fruityblox.com responded ${res.status}`);
      return null;
    }
    text = await res.text();
  } catch (err) {
    console.error('[STOCK] Network error:', err.message);
    return null;
  }

  // Extract the JSON object containing "normal" and "mirage" arrays.
  // The RSC payload embeds it literally, e.g.:
  // {"normal":[{"name":"Rocket","price":5000,...}],"mirage":[...]}
  const match = text.match(/"normal":\[.*?\],"mirage":\[.*?\]/s);
  if (!match) {
    console.warn('[STOCK] Could not locate stock JSON in RSC payload');
    return null;
  }

  let data;
  try {
    data = JSON.parse(`{${match[0]}}`);
  } catch (e) {
    console.warn('[STOCK] JSON parse error:', e.message);
    return null;
  }

  if (!Array.isArray(data.normal) || !Array.isArray(data.mirage)) {
    console.warn('[STOCK] Unexpected data shape from fruityblox.com');
    return null;
  }

  const enrich = (item) => {
    const local = localFruit(item.name);
    return {
      name:       item.name,
      type:       local?.type       ?? item.type ?? 'Natural',
      price:      item.price        ?? local?.price ?? 0,
      robuxPrice: item.robuxPrice   ?? local?.robuxPrice ?? 0,
      rarity:     local?.rarity     ?? 'Common',
      emoji:      local?.emoji      ?? '🍎',
      inStock:    true,
    };
  };

  return {
    normal: data.normal.map(enrich),
    mirage: data.mirage.map(enrich),
  };
}

/**
 * Apply fetched live stock to one guild's stock file.
 * All fruits NOT in the live data are marked inStock: false.
 * Fruits in the live data are added if missing from the guild list.
 */
function applyLiveStock(guildId, liveStock) {
  const current = getStock(guildId);

  // Reset everything to out-of-stock
  for (const arr of [current.normal, current.mirage]) {
    for (const f of arr) f.inStock = false;
  }

  const applyTo = (liveList, storeList) => {
    for (const liveFruit of liveList) {
      const existing = storeList.find(
        f => f.name.toLowerCase() === liveFruit.name.toLowerCase()
      );
      if (existing) {
        existing.inStock = true;
      } else {
        // Fruit not in guild's list yet — add it
        storeList.push({ ...liveFruit, inStock: true });
      }
    }
  };

  applyTo(liveStock.normal, current.normal);
  applyTo(liveStock.mirage, current.mirage);

  saveStock(guildId, current);
  return current;
}

module.exports = { fetchLiveStock, applyLiveStock };
