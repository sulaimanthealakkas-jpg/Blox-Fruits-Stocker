const fs   = require('fs');
const path = require('path');

function inventoryPath(guildId, userId) {
  return path.join(__dirname, '..', 'data', 'guilds', guildId, 'inventory', `${userId}.json`);
}

function getInventory(guildId, userId) {
  const file = inventoryPath(guildId, userId);
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

function saveInventory(guildId, userId, items) {
  const file = inventoryPath(guildId, userId);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(items, null, 2));
}

function addFruit(guildId, userId, fruit) {
  const inv = getInventory(guildId, userId);
  inv.push({ ...fruit, addedAt: new Date().toISOString() });
  saveInventory(guildId, userId, inv);
  return inv;
}

function removeFruit(guildId, userId, fruitName) {
  const inv = getInventory(guildId, userId);
  const idx = inv.findIndex(f => f.name.toLowerCase() === fruitName.toLowerCase());
  if (idx === -1) return null;
  const [removed] = inv.splice(idx, 1);
  saveInventory(guildId, userId, inv);
  return removed;
}

module.exports = { getInventory, addFruit, removeFruit };
