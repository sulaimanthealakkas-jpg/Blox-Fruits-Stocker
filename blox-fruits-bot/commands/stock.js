const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
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

function buildEmbed(stock, view) {
  const updatedAt = new Date(stock.lastUpdated).toUTCString();
  const embed = new EmbedBuilder()
    .setColor(0xFFA500)
    .setFooter({ text: `Last updated • ${updatedAt}` })
    .setTimestamp();

  if (view === 'normal') {
    embed.setTitle('🌍 Normal Stock — Blox Fruits').setDescription(buildLines(stock.normal));
  } else if (view === 'mirage') {
    embed.setTitle('🌙 Mirage Stock — Blox Fruits').setDescription(buildLines(stock.mirage));
  } else {
    embed
      .setTitle('📦 Blox Fruits Stock')
      .addFields(
        { name: '🌍 Normal Stock', value: buildLines(stock.normal), inline: false },
        { name: '\u200B',          value: '\u200B',                 inline: false },
        { name: '🌙 Mirage Stock', value: buildLines(stock.mirage), inline: false },
      );
  }
  return embed;
}

function buildButtons(activeView) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('stock_all')
      .setLabel('📋 All')
      .setStyle(activeView === 'all' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('stock_normal')
      .setLabel('🌍 Normal')
      .setStyle(activeView === 'normal' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('stock_mirage')
      .setLabel('🌙 Mirage')
      .setStyle(activeView === 'mirage' ? ButtonStyle.Primary : ButtonStyle.Secondary),
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stock')
    .setDescription('View the current Blox Fruits stock'),

  async execute(interaction) {
    let view  = 'all';
    const stock = getStock(interaction.guildId);

    const message = await interaction.reply({
      embeds: [buildEmbed(stock, view)],
      components: [buildButtons(view)],
      fetchReply: true,
    });

    // Collect button clicks from anyone for 5 minutes
    const collector = message.createMessageComponentCollector({
      time: 5 * 60 * 1000,
    });

    collector.on('collect', async btn => {
      view = btn.customId.replace('stock_', ''); // 'all' | 'normal' | 'mirage'
      const freshStock = getStock(interaction.guildId);

      await btn.update({
        embeds: [buildEmbed(freshStock, view)],
        components: [buildButtons(view)],
      });
    });

    // After 5 min, disable buttons so they don't error on stale clicks
    collector.on('end', async () => {
      const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('stock_all')   .setLabel('📋 All')    .setStyle(ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder().setCustomId('stock_normal').setLabel('🌍 Normal').setStyle(ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder().setCustomId('stock_mirage').setLabel('🌙 Mirage').setStyle(ButtonStyle.Secondary).setDisabled(true),
      );
      await message.edit({ components: [disabledRow] }).catch(() => {});
    });
  },
};
