const {
  Events,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ChannelType,
  PermissionFlagsBits,
  MessageFlags,
} = require('discord.js');

const allFruits                         = require('../data/fruits.json');
const { buildGuildStock }               = require('../utils/stockManager');
const { ensureStockRoles }              = require('../utils/roleManager');
const { getFruitEmoji, getSelectEmoji } = require('../utils/emojiManager');

const NORMAL_FRUITS = allFruits.filter(f => ['Common', 'Uncommon', 'Rare'].includes(f.rarity));
const MIRAGE_FRUITS = allFruits.filter(f => ['Legendary', 'Mythical'].includes(f.rarity));

const toOption = f => ({
  label:       f.name,
  description: `${f.rarity} ${f.type} • $${f.price.toLocaleString()}`,
  value:       f.name,
  emoji:       getSelectEmoji(f.name),
});

function formatInStock(fruits, inStockNames) {
  const list = fruits.filter(f => inStockNames.includes(f.name));
  if (!list.length) return '_None_';
  return list.map(f => `${getFruitEmoji(f.name)} ${f.name}`).join('\n');
}

module.exports = {
  name: Events.GuildCreate,

  async execute(guild) {
    const { hasStock } = require('../utils/stockManager');
    if (hasStock(guild.id)) return;

    const channel =
      guild.systemChannel ??
      guild.channels.cache
        .filter(c =>
          c.type === ChannelType.GuildText &&
          c.permissionsFor(guild.members.me)?.has([PermissionFlagsBits.SendMessages, PermissionFlagsBits.ViewChannel])
        )
        .sort((a, b) => a.rawPosition - b.rawPosition)
        .first();

    if (!channel) return;

    const msg = await channel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle('👋 Blox Fruits Stock Bot — Setup')
          .setColor(0xFFA500)
          .setDescription(
            'Thanks for adding me! Let\'s set up your server\'s fruit stock.\n\n' +
            '**Two quick steps:**\n' +
            '🌍 Pick which **Normal dealer** fruits are currently in stock\n' +
            '🌙 Pick which **Mirage dealer** fruits are currently in stock\n\n' +
            '_Only members with **Manage Server** can complete setup._'
          )
          .setFooter({ text: 'Wizard expires in 10 minutes' }),
      ],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('setup_start').setLabel('🚀 Set Up Stock Now').setStyle(ButtonStyle.Primary)
        ),
      ],
    });

    let normalInStock = [];
    let mirageInStock = [];
    const collector = msg.createMessageComponentCollector({ time: 10 * 60 * 1000 });

    collector.on('collect', async i => {
      if (!i.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        return i.reply({ content: '🔒 Only members with **Manage Server** can run setup.', flags: MessageFlags.Ephemeral });
      }

      if (i.customId === 'setup_start') {
        await i.update({
          embeds: [
            new EmbedBuilder()
              .setTitle('🌍 Step 1 of 2 — Normal Dealer')
              .setDescription('Select all fruits **currently in stock** at the Normal dealer.\nLeave blank if none are in stock.')
              .setColor(0x2ECC71)
              .setFooter({ text: 'Step 1 of 2' }),
          ],
          components: [
            new ActionRowBuilder().addComponents(
              new StringSelectMenuBuilder()
                .setCustomId('setup_normal')
                .setPlaceholder('Pick fruits in stock at the Normal dealer…')
                .setMinValues(0)
                .setMaxValues(NORMAL_FRUITS.length)
                .addOptions(NORMAL_FRUITS.map(toOption))
            ),
          ],
        });
      }

      else if (i.customId === 'setup_normal') {
        normalInStock = i.values;
        await i.update({
          embeds: [
            new EmbedBuilder()
              .setTitle('🌙 Step 2 of 2 — Mirage Dealer')
              .setDescription('Now select all fruits **currently in stock** at the Mirage dealer.\nLeave blank if none are available.')
              .setColor(0x9B59B6)
              .setFooter({ text: 'Step 2 of 2 • Almost done!' }),
          ],
          components: [
            new ActionRowBuilder().addComponents(
              new StringSelectMenuBuilder()
                .setCustomId('setup_mirage')
                .setPlaceholder('Pick fruits in stock at the Mirage dealer…')
                .setMinValues(0)
                .setMaxValues(MIRAGE_FRUITS.length)
                .addOptions(MIRAGE_FRUITS.map(toOption))
            ),
          ],
        });
      }

      else if (i.customId === 'setup_mirage') {
        mirageInStock = i.values;
        collector.stop('done');
        await i.deferUpdate();

        buildGuildStock(guild.id, normalInStock, mirageInStock);
        const allInStock = [...normalInStock, ...mirageInStock];

        let rolesCreated = 0;
        if (guild.members.me?.permissions.has(PermissionFlagsBits.ManageRoles) && allInStock.length) {
          const results = await ensureStockRoles(guild, allInStock);
          rolesCreated  = results.length;
        }

        await i.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle('✅ Stock Setup Complete!')
              .setColor(0x57F287)
              .addFields(
                { name: '🌍 In Stock — Normal', value: formatInStock(NORMAL_FRUITS, normalInStock), inline: true },
                { name: '🌙 In Stock — Mirage', value: formatInStock(MIRAGE_FRUITS, mirageInStock), inline: true },
              )
              .setDescription(
                rolesCreated > 0
                  ? `📢 **${rolesCreated}** stock-alert role(s) created! Members can self-assign them to get pinged when a fruit restocks.\n\nUse **/setstock** to update, **/stock** to view.`
                  : 'Stock saved! Use **/setstock** to update and **/stock** to view.\n\n_Grant **Manage Roles** to auto-create stock-alert roles._'
              ),
          ],
          components: [],
        });
        console.log(`[SETUP] "${guild.name}" completed setup — ${allInStock.length} in stock, ${rolesCreated} roles.`);
      }
    });

    collector.on('end', (_, reason) => {
      if (reason !== 'done') msg.edit({ components: [] }).catch(() => {});
    });
  },
};
