const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { getInventory } = require('../utils/inventoryManager');

const RARITY_ORDER = ['Mythical', 'Legendary', 'Rare', 'Uncommon', 'Common'];
const RARITY_COLOR = { Common: 0x95A5A6, Uncommon: 0x2ECC71, Rare: 0x3498DB, Legendary: 0xF39C12, Mythical: 0xE74C3C };
const PAGE_SIZE = 8;

function buildPage(items, page, target) {
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const slice = items.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const color = items[0] ? (RARITY_COLOR[items[0].rarity] ?? 0xFFA500) : 0xFFA500;
  const lines = slice.map((f, i) => `\`${String(page * PAGE_SIZE + i + 1).padStart(2, '0')}\` ${f.emoji} **${f.name}** — ${f.rarity} ${f.type}`);

  const embed = new EmbedBuilder()
    .setTitle(`🎒 ${target.username}'s Inventory`)
    .setThumbnail(target.displayAvatarURL({ dynamic: true }))
    .setColor(color)
    .setDescription(items.length ? lines.join('\n') : '_No fruits yet. Use `/roll` or `/additem` to get started!_')
    .addFields(
      { name: '🍎 Total',    value: `\`${items.length}\``,                                         inline: true },
      { name: '🌟 Mythical', value: `\`${items.filter(f => f.rarity === 'Mythical').length}\``,    inline: true },
      { name: '🏆 Legendary',value: `\`${items.filter(f => f.rarity === 'Legendary').length}\``,   inline: true },
    )
    .setFooter({ text: `Page ${page + 1} of ${totalPages}` })
    .setTimestamp();

  return { embed, totalPages };
}

function buildNav(page, totalPages) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('inv_prev').setLabel('◀ Prev').setStyle(ButtonStyle.Secondary).setDisabled(page === 0),
    new ButtonBuilder().setCustomId('inv_next').setLabel('Next ▶').setStyle(ButtonStyle.Secondary).setDisabled(page >= totalPages - 1),
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('inventory')
    .setDescription('View your (or another user\'s) fruit inventory')
    .addUserOption(o => o.setName('user').setDescription('User to check (default: you)')),

  async execute(interaction) {
    const target = interaction.options.getUser('user') ?? interaction.user;
    const raw    = getInventory(interaction.guildId, target.id);
    const items  = [...raw].sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity));

    let page = 0;
    const { embed, totalPages } = buildPage(items, page, target);

    await interaction.reply({ embeds: [embed], components: totalPages > 1 ? [buildNav(page, totalPages)] : [] });
    if (totalPages <= 1) return;

    const message = await interaction.fetchReply();

    const collector = message.createMessageComponentCollector({
      filter: i => i.user.id === interaction.user.id,
      time: 5 * 60 * 1000,
    });

    collector.on('collect', async btn => {
      if (btn.customId === 'inv_prev') page = Math.max(0, page - 1);
      if (btn.customId === 'inv_next') page = Math.min(totalPages - 1, page + 1);
      const fresh = [...getInventory(interaction.guildId, target.id)].sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity));
      const { embed: e, totalPages: tp } = buildPage(fresh, page, target);
      await btn.update({ embeds: [e], components: [buildNav(page, tp)] });
    });

    collector.on('end', async () => { await message.edit({ components: [] }).catch(() => {}); });
  },
};
