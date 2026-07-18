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

const allFruits            = require('../data/fruits.json');
const { buildGuildStock }  = require('../utils/stockManager');
const { ensureStockRoles } = require('../utils/roleManager');

const NORMAL_FRUITS = allFruits.filter(f => ['Common', 'Uncommon', 'Rare'].includes(f.rarity));
const MIRAGE_FRUITS = allFruits.filter(f => ['Legendary', 'Mythical'].includes(f.rarity));

const toOption = f => ({
  label:       f.name,
  description: `${f.rarity} ${f.type} • $${f.price.toLocaleString()}`,
  value:       f.name,
  emoji:       f.emoji,
});

function formatStock(fruits, inStockNames) {
  return fruits.map(f => `${inStockNames.includes(f.name) ? '✅' : '❌'} ${f.emoji} ${f.name}`).join('\n') || '_None_';
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

      // ── Start → Normal select ──────────────────────────────────────────────
      if (i.customId === 'setup_start') {
        await i.update({
          embeds: [
            new EmbedBuilder()
              .setTitle('🌍 Step 1 of 2 — Normal Dealer')
              .setDescription('Select **all fruits currently in stock** at the Normal dealer.\nLeave blank if none are in stock right now.')
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

      // ── Normal selected → Mirage select ───────────────────────────────────
      else if (i.customId === 'setup_normal') {
        normalInStock = i.values;
        await i.update({
          embeds: [
            new EmbedBuilder()
              .setTitle('🌙 Step 2 of 2 — Mirage Dealer')
              .setDescription('Now select **all fruits currently in stock** at the Mirage dealer.\nLeave blank if none are available right now.')
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

      // ── Mirage selected → build + save + roles ─────────────────────────────
      else if (i.customId === 'setup_mirage') {
        mirageInStock = i.values;
        collector.stop('done');
        await i.deferUpdate();

        const stock      = buildGuildStock(guild.id, normalInStock, mirageInStock);
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
                { name: '🌍 Normal Stock', value: formatStock(NORMAL_FRUITS, normalInStock), inline: true },
                { name: '🌙 Mirage Stock', value: formatStock(MIRAGE_FRUITS, mirageInStock), inline: true },
              )
              .setDescription(
                rolesCreated > 0
                  ? `📢 **${rolesCreated}** stock-alert role(s) created! Members can self-assign a role to get pinged when that fruit stocks.\n\nUse **/setstock** to update stock anytime, **/stock** to view it.`
                  : 'Stock saved! Use **/setstock** to update and **/stock** to view.\n\n_Grant me **Manage Roles** to auto-create stock-alert roles._'
              ),
          ],
          components: [],
        });

        console.log(`[SETUP] "${guild.name}" (${guild.id}) completed setup — ${allInStock.length} in stock, ${rolesCreated} roles created.`);
      }
    });

    collector.on('end', (_, reason) => {
      if (reason !== 'done') msg.edit({ components: [] }).catch(() => {});
    });
  },
};
