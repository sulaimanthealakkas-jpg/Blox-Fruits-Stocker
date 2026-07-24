const {
  Events,
  EmbedBuilder,
  ChannelType,
  PermissionFlagsBits,
} = require('discord.js');

const { fetchLiveStock, applyLiveStock } = require('../utils/stockFetcher');
const { getStock }      = require('../utils/stockManager');
const { getFruitEmoji }  = require('../utils/emojiManager');
const { setStockChannel, getConfig } = require('../utils/configManager');

const CATEGORY_NAME  = 'Blox Fruits Stock';
const CHANNEL_NAME   = 'stock-updates';

function buildLines(fruits) {
  const inStock = fruits.filter(f => f.inStock);
  if (!inStock.length) return '_None in stock right now._';
  return inStock
    .map(f =>
      `${getFruitEmoji(f.name)} **${f.name}** *(${f.type})*\n　💰 $${f.price.toLocaleString()} | 💎 R$${f.robuxPrice.toLocaleString()}`
    )
    .join('\n\n');
}

module.exports = {
  name: Events.GuildCreate,

  async execute(guild) {
    console.log(`[SETUP] Joined guild "${guild.name}" (${guild.id}) — starting auto-setup`);

    // ── Permission checks ──────────────────────────────────────────────────
    const me = guild.members.me;
    if (!me) {
      console.warn('[SETUP] Could not resolve bot member — aborting');
      return;
    }

    const canManageChannels = me.permissions.has(PermissionFlagsBits.ManageChannels);
    const canSendMessages   = me.permissions.has(PermissionFlagsBits.SendMessages);

    // ── Decide which channel to send the welcome / status message to ────────
    const welcomeChannel =
      guild.systemChannel ??
      guild.channels.cache
        .filter(c =>
          c.type === ChannelType.GuildText &&
          c.permissionsFor(me)?.has([PermissionFlagsBits.SendMessages, PermissionFlagsBits.ViewChannel])
        )
        .sort((a, b) => a.rawPosition - b.rawPosition)
        .first();

    // ── Helper to post a status update in the welcome channel ───────────────
    async function postStatus(title, description, color) {
      if (!welcomeChannel) return;
      try {
        await welcomeChannel.send({
          embeds: [
            new EmbedBuilder()
              .setTitle(title)
              .setColor(color)
              .setDescription(description)
              .setFooter({ text: 'Blox Fruits Stock Bot' })
              .setTimestamp(),
          ],
        });
      } catch (e) {
        console.warn('[SETUP] Could not post status:', e.message);
      }
    }

    // ── Create or find the category ─────────────────────────────────────────
    let category = guild.channels.cache.find(
      c => c.type === ChannelType.GuildCategory && c.name === CATEGORY_NAME
    );

    if (!category && canManageChannels) {
      try {
        category = await guild.channels.create({
          name: CATEGORY_NAME,
          type: ChannelType.GuildCategory,
          reason: 'Blox Fruits Stock Bot — auto-setup',
        });
        console.log(`[SETUP] Created category "${CATEGORY_NAME}" in ${guild.name}`);
      } catch (err) {
        console.warn(`[SETUP] Could not create category: ${err.message}`);
      }
    }

    // ── Create or find the stock-updates text channel ────────────────────────
    let stockChannel =
      category
        ? guild.channels.cache.find(
            c => c.type === ChannelType.GuildText && c.parentId === category.id && c.name === CHANNEL_NAME
          )
        : guild.channels.cache.find(c => c.type === ChannelType.GuildText && c.name === CHANNEL_NAME);

    if (!stockChannel && canManageChannels) {
      try {
        stockChannel = await guild.channels.create({
          name: CHANNEL_NAME,
          type: ChannelType.GuildText,
          parent: category?.id ?? null,
          topic: 'Live Blox Fruits stock — auto-updated every 30 minutes',
          reason: 'Blox Fruits Stock Bot — auto-setup',
        });
        console.log(`[SETUP] Created channel #${CHANNEL_NAME} in ${guild.name}`);
      } catch (err) {
        console.warn(`[SETUP] Could not create stock channel: ${err.message}`);
      }
    }

    // ── Save the stock channel ID to config so auto-polling posts here ───────
    if (stockChannel) {
      setStockChannel(guild.id, stockChannel.id);
      console.log(`[SETUP] Stock channel saved to config: #${stockChannel.name} (${stockChannel.id})`);
    }

    // ── Fetch live stock from fruityblox.com ─────────────────────────────────
    let live = null;
    try {
      live = await fetchLiveStock();
    } catch (err) {
      console.warn('[SETUP] Live stock fetch failed:', err.message);
    }

    if (live) {
      applyLiveStock(guild.id, live);
      console.log(`[SETUP] Live stock applied to ${guild.id}`);
    } else {
      console.warn('[SETUP] Could not fetch live stock — guild will use cached/default stock');
    }

    const stock = getStock(guild.id);

    // ── Post the initial stock embed in the stock channel ────────────────────
    if (stockChannel) {
      try {
        await stockChannel.send({
          embeds: [
            new EmbedBuilder()
              .setTitle('📦 Blox Fruits Stock — Live')
              .setColor(live ? 0x57F287 : 0xFFA500)
              .setDescription(
                live
                  ? '🟢 **Live stock synced from fruityblox.com**\nThis channel updates automatically every 30 minutes.'
                  : '🟡 **Cached stock** — will sync live on the next poll cycle.'
              )
              .addFields(
                { name: `🌍 Normal Dealer`, value: buildLines(stock.normal), inline: false },
                { name: '\u200B', value: '\u200B', inline: false },
                { name: `🌙 Mirage Dealer`, value: buildLines(stock.mirage), inline: false },
              )
              .setFooter({ text: 'Auto-synced from fruityblox.com • Use /stock to view anytime' })
              .setTimestamp(),
          ],
        });
        console.log(`[SETUP] Posted initial stock in #${stockChannel.name}`);
      } catch (err) {
        console.warn('[SETUP] Could not post stock in channel:', err.message);
      }
    }

    // ── Post a welcome / summary message in the system or first channel ──────
    const channelMention = stockChannel ? `${stockChannel}` : '**#stock-updates** (could not create — check my permissions)';

    await postStatus(
      '👋 Blox Fruits Stock Bot — Setup Complete!',
      canManageChannels
        ? `I've set everything up for you:\n\n` +
          `📂 Created category **${CATEGORY_NAME}**\n` +
          `📦 Created channel ${channelMention}\n` +
          `🔄 Stock is now **live-synced** from fruityblox.com every 30 minutes\n\n` +
          `Use \`/stock\` to view stock anytime, \`/config\` to change settings.\n` +
          `Use \`/help\` to see all commands.`
        : `I don't have **Manage Channels** permission, so I couldn't create a stock channel.\n\n` +
          `Please grant me **Manage Channels** and re-invite, or run \`/config stockchannel\` to set one up manually.\n\n` +
          `Use \`/stock\` to view stock anytime, \`/help\` to see all commands.`,
      canManageChannels ? 0x57F287 : 0xFFA500,
    );

    console.log(`[SETUP] "${guild.name}" setup complete`);
  },
};
