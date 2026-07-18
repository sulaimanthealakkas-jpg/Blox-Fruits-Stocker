const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const stockData = require('../stock.json');

function formatPrice(price) {
  return `$${price.toLocaleString()}`;
}

function formatRobux(robux) {
  return `R$${robux.toLocaleString()}`;
}

function buildStockLines(fruits) {
  if (!fruits || fruits.length === 0) return '*No fruits available.*';

  return fruits
    .map((fruit) => {
      const status = fruit.inStock ? '✅' : '❌';
      return `${status} ${fruit.emoji} **${fruit.name}** *(${fruit.type})*\n　💰 ${formatPrice(fruit.price)} | 💎 ${formatRobux(fruit.robuxPrice)}`;
    })
    .join('\n\n');
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stock')
    .setDescription('View the current Blox Fruits stock')
    .addStringOption((option) =>
      option
        .setName('type')
        .setDescription('Which stock to view')
        .setRequired(false)
        .addChoices(
          { name: '🌍 Normal Stock', value: 'normal' },
          { name: '🌙 Mirage Stock', value: 'mirage' },
          { name: '📋 All Stock', value: 'all' }
        )
    ),

  async execute(interaction) {
    const type = interaction.options.getString('type') ?? 'all';

    const normalLines = buildStockLines(stockData.normal);
    const mirageLines = buildStockLines(stockData.mirage);

    const updatedAt = new Date(stockData.lastUpdated).toUTCString();

    const embed = new EmbedBuilder()
      .setColor(0xFFA500)
      .setThumbnail('https://static.wikia.nocookie.net/bloxfruits/images/b/b6/Site-logo.png')
      .setFooter({ text: `Last updated • ${updatedAt}` })
      .setTimestamp();

    if (type === 'normal') {
      embed
        .setTitle('🌍 Normal Stock — Blox Fruits')
        .setDescription(normalLines);
    } else if (type === 'mirage') {
      embed
        .setTitle('🌙 Mirage Stock — Blox Fruits')
        .setDescription(mirageLines);
    } else {
      embed
        .setTitle('📦 Blox Fruits Stock')
        .addFields(
          { name: '🌍 Normal Stock', value: normalLines, inline: false },
          { name: '\u200B', value: '\u200B', inline: false },
          { name: '🌙 Mirage Stock', value: mirageLines, inline: false }
        );
    }

    await interaction.reply({ embeds: [embed] });
  },
};
