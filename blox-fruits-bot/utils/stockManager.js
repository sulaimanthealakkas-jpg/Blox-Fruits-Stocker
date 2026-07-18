/**
 * Per-guild stock management.
 * Each server gets its own copy at data/guilds/<guildId>/stock.json
 * On first use, the default stock.json is copied as the template.
 */

const fs   = require('fs');
const path = require('path');

const DEFAULT_STOCK = path.join(__dirname, '..', 'stock.json');
const DATA_DIR      = path.join(__dirname, '..', 'data', 'guilds');

function guildStockPath(guildId) {
  return path.join(DATA_DIR, guildId, 'stock.json');
}

function getStock(guildId) {
  const filePath = guildStockPath(guildId);
  if (!fs.existsSync(filePath)) {
    // First time this guild uses the bot — copy the default
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

module.exports = { getStock, saveStock };
