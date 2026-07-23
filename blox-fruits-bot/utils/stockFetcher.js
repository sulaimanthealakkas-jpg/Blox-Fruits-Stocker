/**
 * Fetches real Blox Fruits stock from fruityblox.com by reading
 * their Next.js RSC payload which embeds the live stock JSON.
 */

const { getStock, saveStock } = require('./stockManager');
const allFruits = require('../data/fruits.json');

const RSC_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; BloxFruitsBot/1.0)',
  'RSC': '1',
  'Next-Router-State-Tree': '%5B%22%22%2C%7B%22children%22%3A%5B%22stock%22%2C%7B%22children%22%3A%5B%22__PAGE__%22%2C%7B%7D%5D%7D%5D%7D%2Cnull%2Cnull%2Ctrue%5D',
  'Accept': 'text/x-component',
};

// Find a fruit entry by name from our local fruits.json (case-insensitive)
function findLocalFruit(name) {
  const lower = name.toLowerCase();
  return allFruits.find(f => f.name.toLowerCase() === lower);
}

/**
 * Fetch current stock from fruityblox.com.
 * Returns { normal: [...], mirage: [...] } or null on failure.
 * Each entry: { name, price, robuxPrice, type, inStock: true }
 */
async function fetchLiveStock() {
  try {
    const res = await fetch('https://fruityblox.com/stock', {
      headers: RSC_HEADERS,
    });
    if (!res.ok) {
      console.warn(`[STOCK] fruityblox.com returned ${res.status}`);
      return null;
    }

    const text = await res.text();

    // Extract the JSON object that contains "normal" and "mirage" arrays
    // It appears in the RSC payload like: {"normal":[...],"mirage":[...]}
    const match = text.match(/"normal":\[(\[.*?\]|[^\]]*)\].*?"mirage":\[(\[.*?\]|[^\]]*)\]/s);
    if (!match) {
      // Try a broader approach
      const jsonMatch = text.match(/\{"normal":\[.*?\],"mirage":\[.*?\]\}/s);
      if (!jsonMatch) {
        console.warn('[STOCK] Could not find stock JSON in RSC payload');
        return null;
      }
      return parseStockJson(jsonMatch[0]);
    }

    // Re-extract the full object more reliably
    const startIdx = text.indexOf('"normal":[');
    if (startIdx === -1) return null;

    // Find the opening brace before "normal"
    let braceIdx = startIdx;
    while (braceIdx > 0 && text[braceIdx] !== '{') braceIdx--;

    // Find matching closing brace
    let depth = 0, endIdx = braceIdx;
    for (let i = braceIdx; i < text.length; i++) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}') { depth--; if (depth === 0) { endIdx = i; break; } }
    }

    const jsonStr = text.slice(braceIdx, endIdx + 1);
    return parseStockJson(jsonStr);

  } catch (err) {
    console.error('[STOCK] Fetch error:', err.message);
    return null;
  }
}

function parseStockJson(jsonStr) {
  try {
    const data = JSON.parse(jsonStr);
    if (!Array.isArray(data.normal) || !Array.isArray(data.mirage)) return null;

    const toEntry = (item) => {
      const local = findLocalFruit(item.name);
      return {
        name:       item.name,
        type:       local?.type       || item.type || 'Natural',
        price:      item.price        || local?.price || 0,
        robuxPrice: item.robuxPrice   || local?.robuxPrice || 0,
        rarity:     local?.rarity     || 'Common',
        emoji:      local?.emoji      || '🍎',
        inStock:    true,
      };
    };

    return {
      normal: data.normal.map(toEntry),
      mirage: data.mirage.map(toEntry),
    };
  } catch (err) {
    console.warn('[STOCK] JSON parse error:', err.message);
    return null;
  }
}

/**
 * Apply fetched live stock to a guild's stock file.
 * Marks live fruits as inStock:true, all others as inStock:false.
 */
function applyLiveStock(guildId, liveStock) {
  const current = getStock(guildId);

  // Reset all to out of stock
  for (const arr of [current.normal, current.mirage]) {
    for (const f of arr) f.inStock = false;
  }

  // Mark live normal fruits as in stock
  for (const liveFruit of liveStock.normal) {
    let entry = current.normal.find(f => f.name.toLowerCase() === liveFruit.name.toLowerCase());
    if (!entry) {
      // Fruit exists in live but not in this guild's list — add it
      entry = { ...liveFruit, inStock: true };
      current.normal.push(entry);
    } else {
      entry.inStock = true;
    }
  }

  // Mark live mirage fruits as in stock
  for (const liveFruit of liveStock.mirage) {
    let entry = current.mirage.find(f => f.name.toLowerCase() === liveFruit.name.toLowerCase());
    if (!entry) {
      entry = { ...liveFruit, inStock: true };
      current.mirage.push(entry);
    } else {
      entry.inStock = true;
    }
  }

  saveStock(guildId, current);
  return current;
}

module.exports = { fetchLiveStock, applyLiveStock };
