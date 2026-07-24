const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require('discord.js');
const allFruits = require('../data/fruits.json');
const { getFruitEmoji, getSelectEmoji } = require('../utils/emojiManager');
const { findFruit } = require('../utils/roleManager');

const PAGE_SIZE = 25;

function fruitLabel(f) {
  return `${f.emoji} ${f.name} (${f.rarity})`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('fruitping')
    .setDescription('Get pinged when specific fruits come in stock at the dealer'),

  async execute(interaction) {
    const member = interaction.member;
    const me = interaction.guild.members.me;

    if (!me?.permissions.has('ManageRoles')) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle('Missing Permission')
            .setDescription('I need **Manage Roles** to assign fruit ping roles. Ask a server admin to grant it.'),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    const existingRoles = new Set(
      member.roles.cache.map(r => r.name)
    );

    const myHighest = me.roles.highest;
    const canAssign = (roleName) => {
      const role = interaction.guild.roles.cache.find(r => r.name === roleName);
      return !role || role.position < myHighest.position;
    };

    const subscribed = allFruits.filter(f =>
      existingRoles.has(`${f.emoji} ${f.name}`)
    );

    const embed = new EmbedBuilder()
      .setTitle('🔔 Fruit Ping Notifications')
      .setColor(0x57F287)
      .setDescription(
        'Pick which fruits you want to be pinged for. When that fruit appears in stock at the dealer, you\'ll get a notification.\n\n' +
        `You're currently subscribed to **${subscribed.length}** fruit${subscribed.length !== 1 ? 's' : ''}.`
      );

    if (subscribed.length > 0) {
      embed.addFields({
        name: 'Your Current Pings',
        value: subscribed.map(f => `${f.emoji} **${f.name}**`).join('\n') || '_None_',
      });
    }

    if (!canAssign(`🍎 Test`)) {
      embed.setColor(0xFFA500)
        .addFields({
          name: '⚠️ Role Hierarchy Issue',
          value: 'My highest role is lower than some fruit roles. Move my role above the fruit roles in server settings so I can assign them.',
        });
    }

    const options = allFruits.slice(0, PAGE_SIZE).map(f => {
      const isSubscribed = existingRoles.has(`${f.emoji} ${f.name}`);
      return {
        label: fruitLabel(f),
        value: f.name,
        emoji: getSelectEmoji(f.name),
        description: isSubscribed ? 'Currently subscribed' : `${f.type} • $${f.price.toLocaleString()}`,
        default: isSubscribed,
      };
    });

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('fruitping_select_0')
        .setPlaceholder('Select fruits to ping you for...')
        .setMinValues(0)
        .setMaxValues(PAGE_SIZE)
        .addOptions(options)
    );

    const pageRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('fruitping_page_0')
        .setLabel(`Page 1 / ${Math.ceil(allFruits.length / PAGE_SIZE)}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId('fruitping_page_next')
        .setLabel('Next Page →')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(allFruits.length <= PAGE_SIZE),
      new ButtonBuilder()
        .setCustomId('fruitping_clear')
        .setLabel('Clear All')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(subscribed.length === 0),
    );

    await interaction.reply({
      embeds: [embed],
      components: [row, pageRow],
      flags: MessageFlags.Ephemeral,
    });

    const message = await interaction.fetchReply();
    let currentPage = 0;
    const totalPages = Math.ceil(allFruits.length / PAGE_SIZE);

    const collector = message.createMessageComponentCollector({ time: 10 * 60 * 1000 });

    collector.on('collect', async btn => {
      await btn.deferUpdate();

      if (btn.customId === 'fruitping_clear') {
        for (const f of subscribed) {
          const roleName = `${f.emoji} ${f.name}`;
          const role = interaction.guild.roles.cache.find(r => r.name === roleName);
          if (role) await member.roles.remove(role).catch(() => {});
        }
        subscribed.length = 0;

        const cleared = EmbedBuilder.from(embed)
          .setColor(0x57F287)
          .setDescription(
            'Pick which fruits you want to be pinged for. When that fruit appears in stock at the dealer, you\'ll get a notification.\n\n' +
            'You\'re currently subscribed to **0** fruits.'
          )
          .setFields({
            name: 'Your Current Pings',
            value: '_None_',
          });

        await btn.editReply({ embeds: [cleared], components: [row, pageRow] });
        return;
      }

      if (btn.customId === 'fruitping_page_next' || btn.customId === 'fruitping_page_prev') {
        if (btn.customId === 'fruitping_page_next') {
          currentPage = (currentPage + 1) % totalPages;
        } else {
          currentPage = (currentPage - 1 + totalPages) % totalPages;
        }

        const slice = allFruits.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
        const pageOptions = slice.map(f => {
          const isSub = existingRoles.has(`${f.emoji} ${f.name}`);
          return {
            label: fruitLabel(f),
            value: f.name,
            emoji: getSelectEmoji(f.name),
            description: isSub ? 'Currently subscribed' : `${f.type} • $${f.price.toLocaleString()}`,
            default: isSub,
          };
        });

        const newRow = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`fruitping_select_${currentPage}`)
            .setPlaceholder('Select fruits to ping you for...')
            .setMinValues(0)
            .setMaxValues(pageOptions.length)
            .addOptions(pageOptions)
        );

        const newPageRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('fruitping_page_prev')
            .setLabel('← Prev')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(totalPages <= 1),
          new ButtonBuilder()
            .setCustomId('fruitping_page_label')
            .setLabel(`Page ${currentPage + 1} / ${totalPages}`)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId('fruitping_page_next')
            .setLabel('Next →')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(totalPages <= 1),
          new ButtonBuilder()
            .setCustomId('fruitping_clear')
            .setLabel('Clear All')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(subscribed.length === 0),
        );

        await btn.editReply({ embeds: [embed], components: [newRow, newPageRow] });
        return;
      }

      if (btn.customId.startsWith('fruitping_select_')) {
        const selected = btn.values || [];
        const pageStart = currentPage * PAGE_SIZE;
        const pageFruits = allFruits.slice(pageStart, pageStart + PAGE_SIZE);

        const { ensureStockRole } = require('../utils/roleManager');

        for (const fruit of pageFruits) {
          const roleName = `${fruit.emoji} ${fruit.name}`;
          const shouldHave = selected.includes(fruit.name);
          const hasRole = existingRoles.has(roleName);

          if (shouldHave && !hasRole) {
            const role = await ensureStockRole(interaction.guild, fruit.name);
            if (role) {
              await member.roles.add(role).catch(() => {});
              existingRoles.add(roleName);
              if (!subscribed.find(f => f.name === fruit.name)) {
                subscribed.push(fruit);
              }
            }
          } else if (!shouldHave && hasRole) {
            const role = interaction.guild.roles.cache.find(r => r.name === roleName);
            if (role) {
              await member.roles.remove(role).catch(() => {});
              existingRoles.delete(roleName);
              const idx = subscribed.findIndex(f => f.name === fruit.name);
              if (idx !== -1) subscribed.splice(idx, 1);
            }
          }
        }

        const updatedEmbed = new EmbedBuilder()
          .setTitle('🔔 Fruit Ping Notifications')
          .setColor(0x57F287)
          .setDescription(
            'Pick which fruits you want to be pinged for. When that fruit appears in stock at the dealer, you\'ll get a notification.\n\n' +
            `You're currently subscribed to **${subscribed.length}** fruit${subscribed.length !== 1 ? 's' : ''}.`
          );

        if (subscribed.length > 0) {
          updatedEmbed.addFields({
            name: 'Your Current Pings',
            value: subscribed.map(f => `${f.emoji} **${f.name}**`).join('\n') || '_None_',
          });
        }

        const pageOptions = pageFruits.map(f => {
          const isSub = existingRoles.has(`${f.emoji} ${f.name}`);
          return {
            label: fruitLabel(f),
            value: f.name,
            emoji: getSelectEmoji(f.name),
            description: isSub ? 'Currently subscribed' : `${f.type} • $${f.price.toLocaleString()}`,
            default: isSub,
          };
        });

        const selectRow = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`fruitping_select_${currentPage}`)
            .setPlaceholder('Select fruits to ping you for...')
            .setMinValues(0)
            .setMaxValues(pageOptions.length)
            .addOptions(pageOptions)
        );

        const navRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('fruitping_page_prev')
            .setLabel('← Prev')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(totalPages <= 1),
          new ButtonBuilder()
            .setCustomId('fruitping_page_label')
            .setLabel(`Page ${currentPage + 1} / ${totalPages}`)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId('fruitping_page_next')
            .setLabel('Next →')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(totalPages <= 1),
          new ButtonBuilder()
            .setCustomId('fruitping_clear')
            .setLabel('Clear All')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(subscribed.length === 0),
        );

        await btn.editReply({ embeds: [updatedEmbed], components: [selectRow, navRow] });
      }
    });

    collector.on('end', async () => {
      const disabledRow = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('fruitping_disabled')
          .setPlaceholder('Session expired — run /fruitping again')
          .setDisabled(true)
          .addOptions([{ label: 'Expired', value: 'expired' }])
      );
      await message.edit({ components: [disabledRow] }).catch(() => {});
    });
  },
};
