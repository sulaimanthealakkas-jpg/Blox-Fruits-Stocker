const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getStock } = require('../utils/stockManager');

function formatPrice(n) {
  return `$${n.toLocaleString()}`;
}

function buildLines(fruits) {
  if (!fruits || fruits.length === 0) return '_No fruits listed._';
  return fruits
    .map(f => {
      const status = f.inStock ? '✅' : '❌';
      return `${status} ${f.emoji} **${f.name}** *(${f.type})*\n　💰 ${formatPrice(f.price)} | 💎 R$${f.robuxPrice.toLocaleString()}`;
    })
    .join('\n\n');
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stock')
    .setDescription('View the current Blox Fruits stock')
    .addStringOption(opt =>
      opt.setName('type')
        .setDescription('Which stock to view')
        .addChoices(
          { name: '🌍 Normal', value: 'normal' },
          { name: '🌙 Mirage', value: 'mirage' },
          { name: '📋 All',    value: 'all'    }
        )
    ),

  async execute(interaction) {
    const type    = interaction.options.getString('type') ?? 'all';
    const stock   = getStock(interaction.guildId);
    const updated = new Date(stock.lastUpdated).toUTCString();

    const embed = new EmbedBuilder()
      .setColor(0xFFA500)
      .setFooter({ text: `Last updated • ${updated}` })
      .setTimestamp();

    if (type === 'normal') {
      embed.setTitle('🌍 Normal Stock — Blox Fruits').setDescription(buildLines(stock.normal));
    } else if (type === 'mirage') {
      embed.setTitle('🌙 Mirage Stock — Blox Fruits').setDescription(buildLines(stock.mirage));
    } else {
      embed
        .setTitle('📦 Blox Fruits Stock')
        .addFields(
          { name: '🌍 Normal Stock', value: buildLines(stock.normal), inline: false },
          { name: '\u200B',          value: '\u200B',                 inline: false },
          { name: '🌙 Mirage Stock', value: buildLines(stock.mirage), inline: false }
        );
    }

    await interaction.reply({ embeds: [embed] });
  },
};
