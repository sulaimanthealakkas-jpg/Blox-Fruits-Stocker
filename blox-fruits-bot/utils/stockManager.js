const fs        = require('fs');
const path      = require('path');
const allFruits = require('../data/fruits.json');

const DEFAULT_STOCK = path.join(__dirname, '..', 'stock.json');
const DATA_DIR      = path.join(__dirname, '..', 'data', 'guilds');

function guildStockPath(guildId) {
  return path.join(DATA_DIR, guildId, 'stock.json');
}

function getStock(guildId) {
  const filePath = guildStockPath(guildId);
  if (!fs.existsSync(filePath)) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.copyFileSync(DEFAULT_STOCK, filePath);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function saveStock(guildId, data) {
  const filePath = guildStockPath(guildId);
  data.lastUpdated = new Date().toISOString();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

/** Returns true if the guild already has a custom stock file. */
function hasStock(guildId) {
  return fs.existsSync(guildStockPath(guildId));
}

/**
 * Build and save a guild's stock from two arrays of selected fruit names.
 * Pulls full fruit data (price, type, emoji) from fruits.json.
 * @param {string}   guildId
 * @param {string[]} normalNames  — fruits chosen for the Normal dealer
 * @param {string[]} mirageNames  — fruits chosen for the Mirage dealer
 * @param {string[]} inStockNormal — subset of normalNames currently in stock
 * @param {string[]} inStockMirage — subset of mirageNames currently in stock
 */
function buildGuildStock(guildId, inStockNormal, inStockMirage) {
  // Pool: use ALL fruits that belong to each dealer tier
  const normalPool  = allFruits.filter(f => ['Common', 'Uncommon', 'Rare'].includes(f.rarity));
  const miragePool  = allFruits.filter(f => ['Legendary', 'Mythical'].includes(f.rarity));

  const toEntry = (fruit, inStockNames) => ({
    name:        fruit.name,
    type:        fruit.type,
    price:       fruit.price,
    robuxPrice:  fruit.robuxPrice,
    inStock:     inStockNames.includes(fruit.name),
    emoji:       fruit.emoji,
  });

  const stock = {
    lastUpdated: new Date().toISOString(),
    normal: normalPool.map(f => toEntry(f, inStockNormal)),
    mirage: miragePool.map(f => toEntry(f, inStockMirage)),
  };

  saveStock(guildId, stock);
  return stock;
}

module.exports = { getStock, saveStock, hasStock, buildGuildStock };
