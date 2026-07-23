const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  MessageFlags,
} = require('discord.js');
const { fetchLiveStock, applyLiveStock } = require('../utils/stockFetcher');
const { getStock }    = require('../utils/stockManager');
const { getFruitEmoji } = require('../utils/emojiManager');

function buildLines(fruits) {
  const inStock = fruits.filter(f => f.inStock);
  if (!inStock.length) return '_None in stock right now._';
  return inStock
    .map(f => `${getFruitEmoji(f.name)} **${f.name}** *(${f.type})*  💰 $${f.price.toLocaleString()} | R$${f.robuxPrice.toLocaleString()}`)
    .join('\n');
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('autostock')
    .setDescription('Manually pull the latest real stock from fruityblox.com right now')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const live = await fetchLiveStock();

    if (!live) {
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle('❌ Fetch Failed')
            .setDescription(
              'Could not reach fruityblox.com right now.\n' +
              'The site may be temporarily down — the bot will retry automatically every 30 minutes.'
            ),
        ],
      });
    }

    // Apply to this guild
    applyLiveStock(interaction.guildId, live);
    const updated = getStock(interaction.guildId);

    const embed = new EmbedBuilder()
      .setTitle('✅ Stock Synced from fruityblox.com')
      .setColor(0x57F287)
      .addFields(
        { name: `🌍 Normal Dealer (${live.normal.length} fruit${live.normal.length !== 1 ? 's' : ''})`, value: buildLines(updated.normal) },
        { name: '\u200B', value: '\u200B' },
        { name: `🌙 Mirage Dealer (${live.mirage.length} fruit${live.mirage.length !== 1 ? 's' : ''})`, value: buildLines(updated.mirage) },
      )
      .setFooter({ text: 'Bot checks automatically every 30 min • Use /config stockchannel to get auto-posts' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    // Also post publicly to the stock channel if configured
    const { getConfig } = require('../utils/configManager');
    const cfg = getConfig(interaction.guildId);
    if (cfg.stockChannelId && cfg.stockChannelId !== interaction.channelId) {
      const ch = interaction.guild.channels.cache.get(cfg.stockChannelId);
      if (ch) {
        await ch.send({
          embeds: [
            new EmbedBuilder()
              .setTitle('📦 Blox Fruits Stock — Live Update')
              .setColor(0xFFA500)
              .addFields(
                { name: '🌍 Normal Stock', value: buildLines(updated.normal) },
                { name: '\u200B', value: '\u200B' },
                { name: '🌙 Mirage Stock', value: buildLines(updated.mirage) },
              )
              .setFooter({ text: 'Synced from fruityblox.com' })
              .setTimestamp(),
          ],
        });
      }
    }
  },
};
