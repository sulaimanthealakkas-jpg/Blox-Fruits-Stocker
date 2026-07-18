const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  MessageFlags,
} = require('discord.js');
const { getStock, saveStock } = require('../utils/stockManager');
const { ensureStockRole }     = require('../utils/roleManager');

function formatPrice(n) { return `$${n.toLocaleString()}`; }

function buildLines(fruits) {
  if (!fruits || fruits.length === 0) return '_No fruits listed._';
  return fruits
    .filter(f => f.inStock !== undefined)
    .map(f => `${f.inStock ? '✅' : '❌'} ${f.emoji} **${f.name}** *(${f.type})*\n　💰 ${formatPrice(f.price)} | 💎 R$${f.robuxPrice.toLocaleString()}`)
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

    const allEntries     = [...stock.normal, ...stock.mirage];
    const inStockFruits  = allEntries.filter(f => f.inStock);
    const outOfStock     = allEntries.filter(f => !f.inStock);

    const fruitOptions = allEntries.slice(0, 25).map(f => ({
      label:       f.name,
      description: `${f.name in stock.normal ? '🌍 Normal' : '🌙 Mirage'} • ${formatPrice(f.price)} • ${f.inStock ? '✅ In Stock' : '❌ Out of Stock'}`,
      value:       `${stock.normal.find(n => n.name === f.name) ? 'normal' : 'mirage'}::${f.name}`,
      emoji:       f.emoji,
    }));

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('📦 Set Stock — Step 1 of 2')
          .setDescription('Which fruit do you want to update?')
          .setColor(0xFFA500)
          .addFields(
            { name: '✅ Currently In Stock', value: inStockFruits.map(f => `${f.emoji} ${f.name}`).join(', ') || '_None_' },
            { name: '❌ Out of Stock',        value: outOfStock.map(f => `${f.emoji} ${f.name}`).join(', ')    || '_None_' },
          )
          .setFooter({ text: 'Times out in 60 seconds' }),
      ],
      components: [
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder().setCustomId('setstock_fruit').setPlaceholder('🍎 Pick a fruit to update...').addOptions(fruitOptions)
        ),
      ],
      flags: MessageFlags.Ephemeral,
    });

    // ── Step 1: Wait for fruit selection ────────────────────────────────────
    let fruitInteraction;
    try {
      fruitInteraction = await interaction.channel.awaitMessageComponent({
        filter: i => i.customId === 'setstock_fruit' && i.user.id === interaction.user.id,
        time: 60_000,
      });
    } catch {
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor(0xED4245).setDescription('⏱️ Timed out. Run `/setstock` again.')],
        components: [],
      });
    }

    const [dealer, fruitName] = fruitInteraction.values[0].split('::');
    const fruit = stock[dealer].find(f => f.name === fruitName);

    // ── Step 2: In stock or not? ─────────────────────────────────────────────
    await fruitInteraction.update({
      embeds: [
        new EmbedBuilder()
          .setTitle('📦 Set Stock — Step 2 of 2')
          .setDescription(`Is ${fruit.emoji} **${fruit.name}** currently in stock?`)
          .setColor(0xFFA500)
          .setFooter({ text: 'Times out in 60 seconds' }),
      ],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('setstock_yes').setLabel('✅  In Stock').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('setstock_no') .setLabel('❌  Out of Stock').setStyle(ButtonStyle.Danger),
        ),
      ],
    });

    let stockInteraction;
    try {
      stockInteraction = await interaction.channel.awaitMessageComponent({
        filter: i => ['setstock_yes', 'setstock_no'].includes(i.customId) && i.user.id === interaction.user.id,
        time: 60_000,
      });
    } catch {
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor(0xED4245).setDescription('⏱️ Timed out. Run `/setstock` again.')],
        components: [],
      });
    }

    const inStock    = stockInteraction.customId === 'setstock_yes';
    const wasInStock = fruit.inStock;
    fruit.inStock    = inStock;
    saveStock(guildId, stock);

    const updated   = getStock(guildId);
    const updatedAt = new Date(updated.lastUpdated).toUTCString();

    // ── Auto-create stock-alert role ─────────────────────────────────────────
    let roleMention = '';
    try {
      const role = await ensureStockRole(interaction.guild, fruit.name);
      if (role) roleMention = `${role} `;
    } catch (err) {
      console.warn('[ROLE] Could not manage role:', err.message);
    }

    // ── Post updated stock embed publicly ────────────────────────────────────
    const stockEmbed = new EmbedBuilder()
      .setTitle('📦 Blox Fruits Stock')
      .setColor(0xFFA500)
      .addFields(
        { name: '🌍 Normal Stock', value: buildLines(updated.normal), inline: false },
        { name: '\u200B',          value: '\u200B',                   inline: false },
        { name: '🌙 Mirage Stock', value: buildLines(updated.mirage), inline: false },
      )
      .setFooter({ text: `Last updated • ${updatedAt}` })
      .setTimestamp();

    if (inStock && roleMention) {
      await interaction.channel.send({
        content: `📢 ${roleMention}**${fruit.name}** is now **In Stock**! Get it while it lasts! ${fruit.emoji}`,
        embeds: [stockEmbed],
      });
    } else {
      await interaction.channel.send({ embeds: [stockEmbed] });
    }

    // ── Private confirmation ─────────────────────────────────────────────────
    await stockInteraction.update({
      embeds: [
        new EmbedBuilder()
          .setTitle('✅ Stock Updated!')
          .setColor(inStock ? 0x57F287 : 0xED4245)
          .addFields(
            { name: 'Fruit',  value: `${fruit.emoji} **${fruit.name}**`,                       inline: true },
            { name: 'Dealer', value: dealer === 'normal' ? '🌍 Normal' : '🌙 Mirage',          inline: true },
            { name: 'Status', value: `${wasInStock ? '✅' : '❌'} → ${inStock ? '✅' : '❌'}`, inline: true },
            { name: 'Role',   value: roleMention || '_Grant me **Manage Roles** to auto-create alert roles_', inline: false },
          ),
      ],
      components: [],
    });
  },
};
