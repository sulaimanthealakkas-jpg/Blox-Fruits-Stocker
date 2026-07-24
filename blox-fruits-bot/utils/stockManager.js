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

function hasStock(guildId) {
  return fs.existsSync(guildStockPath(guildId));
}

function buildGuildStock(guildId, inStockNormal, inStockMirage) {
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
