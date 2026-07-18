const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const fs = require('fs');
const path = require('path');

const stockPath = path.join(__dirname, '..', 'stock.json');

function readStock() {
  return JSON.parse(fs.readFileSync(stockPath, 'utf-8'));
}

function writeStock(data) {
  data.lastUpdated = new Date().toISOString();
  fs.writeFileSync(stockPath, JSON.stringify(data, null, 2));
}

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

// Build choices from stock.json at load time
const stockData = readStock();
const allFruits = [
  ...stockData.normal.map(f => ({ name: `🌍 ${f.name} (Normal)`, value: `normal::${f.name}` })),
  ...stockData.mirage.map(f => ({ name: `🌙 ${f.name} (Mirage)`, value: `mirage::${f.name}` })),
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setstock')
    .setDescription('Update a fruit\'s stock status and post the updated stock to this channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(opt =>
      opt
        .setName('fruit')
        .setDescription('The fruit to update')
        .setRequired(true)
        .addChoices(...allFruits)
    )
    .addBooleanOption(opt =>
      opt
        .setName('instock')
        .setDescription('Is this fruit currently in stock?')
        .setRequired(true)
    ),

  async execute(interaction) {
    const raw = interaction.options.getString('fruit');      // e.g. "normal::Flame"
    const inStock = interaction.options.getBoolean('instock');

    const [dealer, fruitName] = raw.split('::');

    // Load fresh from disk, update, write back
    const stock = readStock();
    const list = stock[dealer];
    const fruit = list.find(f => f.name === fruitName);

    if (!fruit) {
      return interaction.reply({
        content: `❌ Could not find **${fruitName}** in the **${dealer}** stock list.`,
        ephemeral: true,
      });
    }

    const wasInStock = fruit.inStock;
    fruit.inStock = inStock;
    writeStock(stock);

    // Re-read to get updated lastUpdated
    const updated = readStock();
    const updatedAt = new Date(updated.lastUpdated).toUTCString();

    const statusChange = `${wasInStock ? '✅' : '❌'} → ${inStock ? '✅' : '❌'}`;

    // Full stock embed for the channel
    const stockEmbed = new EmbedBuilder()
      .setTitle('📦 Blox Fruits Stock')
      .setColor(0xFFA500)
      .addFields(
        { name: '🌍 Normal Stock', value: buildLines(updated.normal), inline: false },
        { name: '\u200B', value: '\u200B', inline: false },
        { name: '🌙 Mirage Stock', value: buildLines(updated.mirage), inline: false }
      )
      .setFooter({ text: `Last updated • ${updatedAt}` })
      .setTimestamp();

    // Confirmation embed (ephemeral, only visible to the admin)
    const confirmEmbed = new EmbedBuilder()
      .setTitle('✏️ Stock Updated')
      .setColor(inStock ? 0x57F287 : 0xED4245)
      .addFields(
        { name: 'Fruit',   value: `${fruit.emoji} **${fruit.name}**`, inline: true },
        { name: 'Dealer',  value: dealer === 'normal' ? '🌍 Normal' : '🌙 Mirage', inline: true },
        { name: 'Status',  value: statusChange, inline: true },
      )
      .setTimestamp();

    // Send public stock embed to the channel, then send ephemeral confirmation
    await interaction.channel.send({ embeds: [stockEmbed] });
    await interaction.reply({ embeds: [confirmEmbed], ephemeral: true });
  },
};
