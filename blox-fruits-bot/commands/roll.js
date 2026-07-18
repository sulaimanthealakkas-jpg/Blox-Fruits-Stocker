const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fruits = require('../data/fruits.json');
const { addFruit } = require('../utils/inventoryManager');

const RARITY_CONFIG = {
  Common:    { color: 0x95A5A6, chance: 40, stars: '⭐' },
  Uncommon:  { color: 0x2ECC71, chance: 30, stars: '⭐⭐' },
  Rare:      { color: 0x3498DB, chance: 18, stars: '⭐⭐⭐' },
  Legendary: { color: 0xF39C12, chance: 9,  stars: '⭐⭐⭐⭐' },
  Mythical:  { color: 0xE74C3C, chance: 3,  stars: '⭐⭐⭐⭐⭐' },
};

// Weighted random roll
function rollFruit() {
  const pool = [];
  for (const fruit of fruits) {
    const weight = RARITY_CONFIG[fruit.rarity].chance;
    for (let i = 0; i < weight; i++) pool.push(fruit);
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

function randomFruits(count) {
  return Array.from({ length: count }, () => fruits[Math.floor(Math.random() * fruits.length)]);
}

function spinLine(fs) {
  return fs.map(f => `${f.emoji} ~~${f.name}~~`).join('  •  ');
}

const cooldowns = new Map();
const COOLDOWN_MS = 30_000;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roll')
    .setDescription('Roll a random Blox Fruit — result is added to your inventory'),

  async execute(interaction) {
    const userId = interaction.user.id;

    // Cooldown check
    if (cooldowns.has(userId)) {
      const remaining = Math.ceil((cooldowns.get(userId) - Date.now()) / 1000);
      if (remaining > 0) {
        return interaction.reply({
          content: `⏳ Slow down! You can roll again in **${remaining}s**.`,
          ephemeral: true,
        });
      }
    }

    cooldowns.set(userId, Date.now() + COOLDOWN_MS);
    setTimeout(() => cooldowns.delete(userId), COOLDOWN_MS);

    const result = rollFruit();
    const cfg    = RARITY_CONFIG[result.rarity];

    // ── Spin animation ───────────────────────────────────────────────────────
    const msg = await interaction.reply({
      content: `🎰  **Rolling your fruit...**\n${spinLine(randomFruits(3))}`,
      fetchReply: true,
    });

    await new Promise(r => setTimeout(r, 700));
    await interaction.editReply(`🎰  **Almost...**\n${spinLine(randomFruits(3))}`);

    await new Promise(r => setTimeout(r, 700));
    await interaction.editReply(`🎰  **Wait for it...**\n${spinLine(randomFruits(3))}`);

    await new Promise(r => setTimeout(r, 900));

    // ── Result ───────────────────────────────────────────────────────────────
    addFruit(interaction.guildId, userId, result);

    const embed = new EmbedBuilder()
      .setTitle(`${result.emoji}  You rolled **${result.name}**!`)
      .setColor(cfg.color)
      .addFields(
        { name: '✨ Rarity',  value: `${cfg.stars} ${result.rarity}`, inline: true },
        { name: '🔮 Type',    value: result.type,                      inline: true },
        { name: '\u200B',     value: '\u200B',                          inline: true },
        { name: '💰 Price',   value: `$${result.price.toLocaleString()}`,      inline: true },
        { name: '💎 Robux',   value: `R$${result.robuxPrice.toLocaleString()}`, inline: true },
      )
      .setFooter({ text: `Rolled by ${interaction.user.username} • Added to inventory` })
      .setTimestamp();

    if (result.rarity === 'Mythical') {
      embed.setDescription('> 🌟 **MYTHICAL ROLL!** Incredibly rare!');
    } else if (result.rarity === 'Legendary') {
      embed.setDescription('> 🎊 **LEGENDARY!** Nice pull!');
    }

    await interaction.editReply({ content: '', embeds: [embed] });
  },
};
