const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  MessageFlags,
} = require('discord.js');
const { fetchLiveStock, applyLiveStock } = require('../utils/stockFetcher');
const { getStock }      = require('../utils/stockManager');
const { getFruitEmoji } = require('../utils/emojiManager');
const { getConfig }     = require('../utils/configManager');
const { ensureStockRole } = require('../utils/roleManager');

function buildLines(fruits) {
  if (!fruits.length) return '_None in stock._';
  return fruits
    .filter(f => f.inStock)
    .map(f => `${getFruitEmoji(f.name)} **${f.name}** *(${f.type})*  💰 $${f.price.toLocaleString()} | R$${f.robuxPrice.toLocaleString()}`)
    .join('\n') || '_None in stock._';
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setstock')
    .setDescription('Force an immediate stock refresh from fruityblox.com right now')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const live = await fetchLiveStock();

    if (!live) {
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle('❌ Could not reach fruityblox.com')
            .setDescription('The site may be temporarily down. The bot retries automatically every 30 minutes.'),
        ],
      });
    }

    applyLiveStock(interaction.guildId, live);
    const updated = getStock(interaction.guildId);

    const publicEmbed = new EmbedBuilder()
      .setTitle('📦 Blox Fruits Stock — Refreshed')
      .setColor(0x57F287)
      .addFields(
        { name: `🌍 Normal Dealer (${live.normal.length} fruit${live.normal.length !== 1 ? 's' : ''})`, value: buildLines(updated.normal) },
        { name: '\u200B', value: '\u200B' },
        { name: `🌙 Mirage Dealer (${live.mirage.length} fruit${live.mirage.length !== 1 ? 's' : ''})`, value: buildLines(updated.mirage) },
      )
      .setFooter({ text: '🟢 Live data from fruityblox.com • /fruitping to get notified' })
      .setTimestamp();

    const pingMentions = [];
    const allInStock = [...live.normal, ...live.mirage];
    for (const fruit of allInStock) {
      try {
        const role = await ensureStockRole(interaction.guild, fruit.name);
        if (role) pingMentions.push(role.toString());
      } catch {}
    }

    const content = pingMentions.length
      ? `🔔 **Stock refreshed!** ${pingMentions.join(' ')}`
      : '';

    await interaction.channel.send({
      content: content || undefined,
      embeds: [publicEmbed],
      allowedMentions: { roles: pingMentions.map(m => m.match(/\d+/)?.[0]).filter(Boolean) },
    });

    const cfg = getConfig(interaction.guildId);
    if (cfg.stockChannelId && cfg.stockChannelId !== interaction.channelId) {
      const ch = interaction.guild.channels.cache.get(cfg.stockChannelId);
      if (ch) await ch.send({
        content: content || undefined,
        embeds: [publicEmbed],
        allowedMentions: { roles: pingMentions.map(m => m.match(/\d+/)?.[0]).filter(Boolean) },
      }).catch(() => {});
    }

    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x57F287)
          .setDescription('✅ Stock refreshed from fruityblox.com and posted publicly.'),
      ],
    });
  },
};
