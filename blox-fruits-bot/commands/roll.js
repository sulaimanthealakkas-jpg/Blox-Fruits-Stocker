const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const allFruits          = require('../data/fruits.json');
const { addFruit }       = require('../utils/inventoryManager');
const { getFruitEmoji }  = require('../utils/emojiManager');
const { getRollCooldownMs } = require('../utils/configManager');

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

function formatTimeLeft(ms) {
  const totalSecs = Math.ceil(ms / 1000);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roll')
    .setDescription('Roll a random Blox Fruit — result added to your inventory'),

  async execute(interaction) {
    const userId  = interaction.user.id;
    const guildId = interaction.guildId;

    const expiresAt = cooldowns.get(`${guildId}:${userId}`);
    if (expiresAt) {
      const remaining = expiresAt - Date.now();
      if (remaining > 0) {
        const cooldownMs = getRollCooldownMs(guildId);
        const hours = cooldownMs / 3_600_000;
        const label = hours < 1 ? `${hours * 60} min` : `${hours}h`;
        return interaction.reply({
          content: `⏳ You can roll again in **${formatTimeLeft(remaining)}**.\n> 🕐 Roll cooldown is set to **${label}** on this server.`,
          flags: MessageFlags.Ephemeral,
        });
      }
    }

    const cooldownMs = getRollCooldownMs(guildId);
    if (cooldownMs > 0) {
      const expires = Date.now() + cooldownMs;
      cooldowns.set(`${guildId}:${userId}`, expires);
      setTimeout(() => cooldowns.delete(`${guildId}:${userId}`), cooldownMs);
    }

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

    const cooldownHours = cooldownMs / 3_600_000;
    const nextRollLabel = cooldownMs === 0 ? 'No cooldown' : `Next roll in ${cooldownHours < 1 ? `${cooldownHours * 60} min` : `${cooldownHours}h`}`;

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
      .setFooter({ text: `Rolled by ${interaction.user.username} • ${nextRollLabel}` })
      .setTimestamp();

    if (result.rarity === 'Mythical')       embed.setDescription('> 🌟 **MYTHICAL ROLL!** Incredibly rare!');
    else if (result.rarity === 'Legendary') embed.setDescription('> 🎊 **LEGENDARY!** Nice pull!');

    await interaction.editReply({ content: '', embeds: [embed] });
  },
};
