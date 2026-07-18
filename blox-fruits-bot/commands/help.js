const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('View all available commands'),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('📖 Blox Fruits Stock Bot — Commands')
      .setColor(0x7C3AED)
      .addFields(
        { name: '`/stock`',      value: 'View fruit stock with **[📋 All] [🌍 Normal] [🌙 Mirage]** buttons.' },
        { name: '`/setstock`',   value: 'Update a fruit\'s stock status step-by-step. *(Requires Manage Server)*' },
        { name: '`/roll`',       value: 'Roll a random fruit with animated spin. Result saved to your inventory. 30s cooldown.' },
        { name: '`/trade`',      value: 'Post a trade and let the server vote **✅ W** or **❌ L**.' },
        { name: '`/inventory`',  value: 'View your fruit collection, sorted by rarity. Check others with `/inventory @user`.' },
        { name: '`/additem`',    value: 'Add any fruit to your inventory using rarity filter buttons + dropdown.' },
        { name: '`/removeitem`', value: 'Remove a fruit from your inventory via dropdown.' },
        { name: '`/ping`',       value: 'Check bot latency, API ping, uptime, and server count.' },
        { name: '`/help`',       value: 'Show this command list.' },
      )
      .setFooter({
        text: `Requested by ${interaction.user.username} • Each server has its own stock & inventories`,
        iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
      })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
