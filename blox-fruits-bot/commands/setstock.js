const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
} = require('discord.js');
const { getStock, saveStock } = require('../utils/stockManager');

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
    .setName('setstock')
    .setDescription('Update the stock for this server')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const stock   = getStock(guildId);

    // ── Step 1: Pick a fruit ────────────────────────────────────────────────
    const fruitOptions = [
      ...stock.normal.map(f => ({
        label: `🌍 ${f.name}`,
        description: `Normal • ${formatPrice(f.price)} • ${f.inStock ? 'In Stock' : 'Out of Stock'}`,
        value: `normal::${f.name}`,
        emoji: f.emoji,
      })),
      ...stock.mirage.map(f => ({
        label: `🌙 ${f.name}`,
        description: `Mirage • ${formatPrice(f.price)} • ${f.inStock ? 'In Stock' : 'Out of Stock'}`,
        value: `mirage::${f.name}`,
        emoji: f.emoji,
      })),
    ];

    const selectRow = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('setstock_fruit')
        .setPlaceholder('🍎 Pick a fruit to update...')
        .addOptions(fruitOptions)
    );

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('📦 Set Stock — Step 1 of 2')
          .setDescription('Which fruit do you want to update?')
          .setColor(0xFFA500)
          .setFooter({ text: 'Times out in 60 seconds' }),
      ],
      components: [selectRow],
      ephemeral: true,
    });

    // ── Wait for fruit selection ────────────────────────────────────────────
    let fruitInteraction;
    try {
      fruitInteraction = await interaction.fetchReply().then(() =>
        interaction.channel.awaitMessageComponent({
          filter: i => i.customId === 'setstock_fruit' && i.user.id === interaction.user.id,
          time: 60_000,
        })
      );
    } catch {
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor(0xED4245).setDescription('⏱️ Timed out. Run `/setstock` again.')],
        components: [],
      });
    }

    const [dealer, fruitName] = fruitInteraction.values[0].split('::');
    const fruitList = stock[dealer];
    const fruit     = fruitList.find(f => f.name === fruitName);

    // ── Step 2: In stock or not? ────────────────────────────────────────────
    const buttonRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('setstock_yes')
        .setLabel('✅  In Stock')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('setstock_no')
        .setLabel('❌  Out of Stock')
        .setStyle(ButtonStyle.Danger),
    );

    await fruitInteraction.update({
      embeds: [
        new EmbedBuilder()
          .setTitle('📦 Set Stock — Step 2 of 2')
          .setDescription(`Is ${fruit.emoji} **${fruit.name}** currently in stock?`)
          .setColor(0xFFA500)
          .setFooter({ text: 'Times out in 60 seconds' }),
      ],
      components: [buttonRow],
    });

    // ── Wait for Yes / No button ────────────────────────────────────────────
    let stockInteraction;
    try {
      stockInteraction = await interaction.channel.awaitMessageComponent({
        filter: i =>
          (i.customId === 'setstock_yes' || i.customId === 'setstock_no') &&
          i.user.id === interaction.user.id,
        time: 60_000,
      });
    } catch {
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor(0xED4245).setDescription('⏱️ Timed out. Run `/setstock` again.')],
        components: [],
      });
    }

    const inStock   = stockInteraction.customId === 'setstock_yes';
    const wasInStock = fruit.inStock;
    fruit.inStock   = inStock;
    saveStock(guildId, stock);

    const updatedStock = getStock(guildId);
    const updatedAt    = new Date(updatedStock.lastUpdated).toUTCString();

    // ── Post updated stock embed to the channel ─────────────────────────────
    const stockEmbed = new EmbedBuilder()
      .setTitle('📦 Blox Fruits Stock')
      .setColor(0xFFA500)
      .addFields(
        { name: '🌍 Normal Stock', value: buildLines(updatedStock.normal), inline: false },
        { name: '\u200B',          value: '\u200B',                         inline: false },
        { name: '🌙 Mirage Stock', value: buildLines(updatedStock.mirage),  inline: false },
      )
      .setFooter({ text: `Last updated • ${updatedAt}` })
      .setTimestamp();

    await interaction.channel.send({ embeds: [stockEmbed] });

    // ── Dismiss the ephemeral prompt with a confirmation ───────────────────
    const statusChange = `${wasInStock ? '✅' : '❌'} → ${inStock ? '✅' : '❌'}`;

    await stockInteraction.update({
      embeds: [
        new EmbedBuilder()
          .setTitle('✅ Stock Updated!')
          .setColor(inStock ? 0x57F287 : 0xED4245)
          .addFields(
            { name: 'Fruit',  value: `${fruit.emoji} **${fruit.name}**`,               inline: true },
            { name: 'Dealer', value: dealer === 'normal' ? '🌍 Normal' : '🌙 Mirage', inline: true },
            { name: 'Status', value: statusChange,                                      inline: true },
          ),
      ],
      components: [],
    });
  },
};
