const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
} = require('discord.js');
const { getInventory, removeFruit } = require('../utils/inventoryManager');

const RARITY_COLOR = {
  Common:    0x95A5A6,
  Uncommon:  0x2ECC71,
  Rare:      0x3498DB,
  Legendary: 0xF39C12,
  Mythical:  0xE74C3C,
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('removeitem')
    .setDescription('Remove a fruit from your inventory'),

  async execute(interaction) {
    const inv = getInventory(interaction.guildId, interaction.user.id);

    if (inv.length === 0) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xED4245)
            .setDescription('❌ Your inventory is empty — nothing to remove.'),
        ],
        ephemeral: true,
      });
    }

    // Deduplicate display but allow removing any occurrence
    const options = inv.slice(0, 25).map((f, i) => ({
      label: f.name,
      description: `${f.rarity} ${f.type} • $${f.price.toLocaleString()}`,
      value: String(i),
      emoji: f.emoji,
    }));

    const selectRow = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('removeitem_pick')
        .setPlaceholder('Pick a fruit to remove...')
        .addOptions(options)
    );

    const message = await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('🗑️ Remove Item')
          .setDescription(`You have **${inv.length}** fruit(s). Pick one to remove.`)
          .setColor(0xED4245)
          .setFooter({ text: 'Times out in 60 seconds' }),
      ],
      components: [selectRow],
      ephemeral: true,
      fetchReply: true,
    });

    const collector = message.createMessageComponentCollector({
      filter: i => i.user.id === interaction.user.id,
      time: 60_000,
    });

    collector.on('collect', async i => {
      const idx    = parseInt(i.values[0]);
      const fruit  = inv[idx];
      removeFruit(interaction.guildId, interaction.user.id, fruit.name);
      collector.stop();

      await i.update({
        embeds: [
          new EmbedBuilder()
            .setTitle('🗑️ Fruit Removed')
            .setColor(RARITY_COLOR[fruit.rarity] ?? 0xFFA500)
            .setDescription(`${fruit.emoji} **${fruit.name}** has been removed from your inventory.`),
        ],
        components: [],
      });
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
