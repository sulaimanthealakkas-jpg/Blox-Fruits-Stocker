const allFruits = require('../data/fruits.json');

const RARITY_COLORS = {
  Common:    0x95A5A6,
  Uncommon:  0x2ECC71,
  Rare:      0x3498DB,
  Legendary: 0xF39C12,
  Mythical:  0xE74C3C,
};

function findFruit(name) {
  return allFruits.find(f => f.name.toLowerCase() === name.toLowerCase());
}

async function ensureStockRole(guild, fruitName) {
  const fruit = findFruit(fruitName);
  if (!fruit) return null;

  const roleName = `${fruit.emoji} ${fruit.name}`;

  const me = guild.members.me;
  if (!me || !me.permissions.has('ManageRoles')) return null;

  let role = guild.roles.cache.find(r => r.name === roleName);

  if (!role) {
    role = await guild.roles.create({
      name: roleName,
      color: RARITY_COLORS[fruit.rarity] ?? 0xFFA500,
      mentionable: true,
      reason: 'Blox Fruits Stock Bot — auto stock-alert role',
    });
    console.log(`[ROLE] Created "${roleName}" in ${guild.name}`);
  }

  return role;
}

async function ensureStockRoles(guild, fruitNames) {
  const results = [];
  for (const name of fruitNames) {
    const role = await ensureStockRole(guild, name);
    if (role) results.push({ role, fruit: findFruit(name) });
  }
  return results;
}

module.exports = { ensureStockRole, ensureStockRoles, findFruit };
