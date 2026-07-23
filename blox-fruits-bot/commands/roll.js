const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const allFruits        = require('../data/fruits.json');
const { addFruit }     = require('../utils/inventoryManager');
const { getFruitEmoji } = require('../utils/emojiManager');

const RARITY_CONFIG = {
  Common:    { color: 0x95A5A6, chance: 40, stars: '⭐' },
  Uncommon:  { color: 0x2ECC71, chance: 30, stars: '⭐⭐' },
  Rare:      { color: 0x3498DB, chance: 18, stars: '⭐⭐⭐' },
  Legendary: { color: 0xF39C12, chance: 9,  stars: '⭐⭐⭐⭐' },
  Mythical:  { color: 0xE74C3C, chance: 3,  stars: '⭐⭐⭐⭐⭐' },
};

function rollFruit() {
  const pool = allFruits.flatMap(f => Array(RARITY_CONFIG[f.rarity].chance).fill(f));
  return pool[Math.floor(Math.random() * pool.length)];
}

function spinLine() {
  return Array.from({ length: 3 }, () => {
    const f = allFruits[Math.floor(Math.random() * allFruits.length)];
    return `${getFruitEmoji(f.name)} ~~${f.name}~~`;
  }).join('  •  ');
}

const cooldowns = new Map();
const COOLDOWN_MS = 30_000;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roll')
    .setDescription('Roll a random Blox Fruit — result is added to your inventory'),

  async execute(interaction) {
    const userId = interaction.user.id;

    if (cooldowns.has(userId)) {
      const remaining = Math.ceil((cooldowns.get(userId) - Date.now()) / 1000);
      if (remaining > 0) {
        return interaction.reply({
          content: `⏳ You can roll again in **${remaining}s**.`,
          flags: MessageFlags.Ephemeral,
        });
      }
    }

    cooldowns.set(userId, Date.now() + COOLDOWN_MS);
    setTimeout(() => cooldowns.delete(userId), COOLDOWN_MS);

    const result = rollFruit();
    const cfg    = RARITY_CONFIG[result.rarity];
    const emoji  = getFruitEmoji(result.name);

    await interaction.reply({ content: `🎰  **Rolling your fruit...**\n${spinLine()}` });
    await new Promise(r => setTimeout(r, 700));
    await interaction.editReply(`🎰  **Almost...**\n${spinLine()}`);
    await new Promise(r => setTimeout(r, 700));
    await interaction.editReply(`🎰  **Wait for it...**\n${spinLine()}`);
    await new Promise(r => setTimeout(r, 900));

    addFruit(interaction.guildId, userId, result);

    const embed = new EmbedBuilder()
      .setTitle(`${emoji}  You rolled **${result.name}**!`)
      .setColor(cfg.color)
      .addFields(
        { name: '✨ Rarity', value: `${cfg.stars} ${result.rarity}`,          inline: true },
        { name: '🔮 Type',   value: result.type,                               inline: true },
        { name: '\u200B',    value: '\u200B',                                   inline: true },
        { name: '💰 Price',  value: `$${result.price.toLocaleString()}`,        inline: true },
        { name: '💎 Robux',  value: `R$${result.robuxPrice.toLocaleString()}`,  inline: true },
      )
      .setFooter({ text: `Rolled by ${interaction.user.username} • Added to inventory` })
      .setTimestamp();

    if (result.rarity === 'Mythical')       embed.setDescription('> 🌟 **MYTHICAL ROLL!** Incredibly rare!');
    else if (result.rarity === 'Legendary') embed.setDescription('> 🎊 **LEGENDARY!** Nice pull!');

    await interaction.editReply({ content: '', embeds: [embed] });
  },
};
