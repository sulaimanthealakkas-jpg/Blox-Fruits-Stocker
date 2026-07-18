const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require('discord.js');
const fruits    = require('../data/fruits.json');
const { addFruit } = require('../utils/inventoryManager');

const RARITY_COLOR = { Common: 0x95A5A6, Uncommon: 0x2ECC71, Rare: 0x3498DB, Legendary: 0xF39C12, Mythical: 0xE74C3C };
const GROUPS = ['Mythical', 'Legendary', 'Rare', 'Uncommon', 'Common'];

function optionsForGroup(rarity) {
  return fruits.filter(f => f.rarity === rarity).map(f => ({
    label: f.name, description: `${f.type} • $${f.price.toLocaleString()}`, value: f.name, emoji: f.emoji,
  }));
}

function rarityButtons(active) {
  return new ActionRowBuilder().addComponents(
    GROUPS.map(r =>
      new ButtonBuilder().setCustomId(`rar_${r}`).setLabel(r).setStyle(r === active ? ButtonStyle.Primary : ButtonStyle.Secondary)
    )
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('additem')
    .setDescription('Add a fruit to your inventory'),

  async execute(interaction) {
    let rarity = 'Mythical';

    const selectRow = () => new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('additem_pick')
        .setPlaceholder(`Pick a ${rarity} fruit...`)
        .addOptions(optionsForGroup(rarity))
    );

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('🎒 Add Item — Pick a Fruit')
          .setDescription('Use the buttons to filter by rarity, then pick from the dropdown.')
          .setColor(RARITY_COLOR[rarity])
          .setFooter({ text: 'Times out in 60 seconds' }),
      ],
      components: [rarityButtons(rarity), selectRow()],
      flags: MessageFlags.Ephemeral,
    });

    const message = await interaction.fetchReply();

    const collector = message.createMessageComponentCollector({
      filter: i => i.user.id === interaction.user.id,
      time: 60_000,
    });

    collector.on('collect', async i => {
      if (i.customId.startsWith('rar_')) {
        rarity = i.customId.replace('rar_', '');
        await i.update({
          embeds: [
            new EmbedBuilder()
              .setTitle('🎒 Add Item — Pick a Fruit')
              .setDescription(`Showing **${rarity}** fruits. Pick one below.`)
              .setColor(RARITY_COLOR[rarity])
              .setFooter({ text: 'Times out in 60 seconds' }),
          ],
          components: [rarityButtons(rarity), selectRow()],
        });
        return;
      }

      if (i.customId === 'additem_pick') {
        const fruit = fruits.find(f => f.name === i.values[0]);
        addFruit(interaction.guildId, interaction.user.id, fruit);
        collector.stop();
        await i.update({
          embeds: [
            new EmbedBuilder()
              .setTitle('✅ Fruit Added!')
              .setColor(RARITY_COLOR[fruit.rarity])
              .setDescription(`${fruit.emoji} **${fruit.name}** has been added to your inventory.`)
              .addFields(
                { name: '✨ Rarity', value: fruit.rarity, inline: true },
                { name: '🔮 Type',   value: fruit.type,   inline: true },
              ),
          ],
          components: [],
        });
      }
    });

    collector.on('end', (_, reason) => {
      if (reason === 'time') {
        interaction.editReply({
          embeds: [new EmbedBuilder().setColor(0xED4245).setDescription('⏱️ Timed out.')],
          components: [],
        }).catch(() => {});
      }
    });
  },
};
