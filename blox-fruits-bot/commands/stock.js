const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { fetchLiveStock, applyLiveStock } = require('../utils/stockFetcher');
const { getStock }       = require('../utils/stockManager');
const { getFruitEmoji }  = require('../utils/emojiManager');

function line(f) {
  return `${getFruitEmoji(f.name)} **${f.name}** *(${f.type})*\n　💰 $${f.price.toLocaleString()} | 💎 R$${f.robuxPrice.toLocaleString()}`;
}

function buildEmbed(normal, mirage, view, live) {
  const tag    = live ? '🟢 Live' : '🟡 Cached';
  const source = live ? 'fruityblox.com (live)' : 'Last cached snapshot';

  const normalLines = normal.length ? normal.map(line).join('\n\n') : '_None in stock._';
  const mirageLines = mirage.length ? mirage.map(line).join('\n\n') : '_None in stock._';

  const embed = new EmbedBuilder()
    .setColor(live ? 0x57F287 : 0xFFA500)
    .setFooter({ text: `${tag} • Source: ${source} • ${new Date().toUTCString()}` })
    .setTimestamp();

  if (view === 'normal') {
    embed.setTitle('🌍 Normal Stock — Blox Fruits').setDescription(normalLines);
  } else if (view === 'mirage') {
    embed.setTitle('🌙 Mirage Stock — Blox Fruits').setDescription(mirageLines);
  } else {
    embed.setTitle('📦 Blox Fruits Stock — Live').addFields(
      { name: `🌍 Normal Dealer  (${normal.length} in stock)`, value: normalLines, inline: false },
      { name: '\u200B', value: '\u200B', inline: false },
      { name: `🌙 Mirage Dealer  (${mirage.length} in stock)`, value: mirageLines, inline: false },
    );
  }
  return embed;
}

function buttons(active) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('stock_all')   .setLabel('📋 All')    .setStyle(active === 'all'    ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('stock_normal').setLabel('🌍 Normal').setStyle(active === 'normal'  ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('stock_mirage').setLabel('🌙 Mirage').setStyle(active === 'mirage'  ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('stock_refresh').setLabel('🔄 Refresh').setStyle(ButtonStyle.Success),
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stock')
    .setDescription('View the current Blox Fruits stock — pulled live from fruityblox.com'),

  async execute(interaction) {
    await interaction.deferReply();

    let normal, mirage, isLive = false;

    const live = await fetchLiveStock();
    if (live) {
      applyLiveStock(interaction.guildId, live);
      normal = live.normal;
      mirage = live.mirage;
      isLive = true;
    } else {
      const cached = getStock(interaction.guildId);
      normal = cached.normal.filter(f => f.inStock);
      mirage = cached.mirage.filter(f => f.inStock);
    }

    let view = 'all';
    await interaction.editReply({
      embeds: [buildEmbed(normal, mirage, view, isLive)],
      components: [buttons(view)],
    });

    const message = await interaction.fetchReply();
    const collector = message.createMessageComponentCollector({ time: 5 * 60 * 1000 });

    collector.on('collect', async btn => {
      await btn.deferUpdate();

      if (btn.customId === 'stock_refresh') {
        const fresh = await fetchLiveStock();
        if (fresh) {
          applyLiveStock(interaction.guildId, fresh);
          normal = fresh.normal;
          mirage = fresh.mirage;
          isLive = true;
        }
      } else {
        view = btn.customId.replace('stock_', '');
      }

      await interaction.editReply({
        embeds: [buildEmbed(normal, mirage, view, isLive)],
        components: [buttons(view)],
      });
    });

    collector.on('end', async () => {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('s1').setLabel('📋 All')    .setStyle(ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder().setCustomId('s2').setLabel('🌍 Normal').setStyle(ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder().setCustomId('s3').setLabel('🌙 Mirage').setStyle(ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder().setCustomId('s4').setLabel('🔄 Refresh').setStyle(ButtonStyle.Secondary).setDisabled(true),
      );
      await message.edit({ components: [row] }).catch(() => {});
    });
  },
};
