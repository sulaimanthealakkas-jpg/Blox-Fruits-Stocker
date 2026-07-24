const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('View all available commands'),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('📖 Blox Fruits Stock Bot — Commands')
      .setColor(0x5865F2)
      .addFields(
        { name: '`/stock`',      value: 'View live fruit stock with All / Normal / Mirage filter buttons.' },
        { name: '`/setstock`',   value: 'Force an immediate stock refresh from fruityblox.com. *(Manage Server)*' },
        { name: '`/autostock`',  value: 'Manually pull the latest real stock from fruityblox.com. *(Manage Server)*' },
        { name: '`/config`',     value: 'View or change bot settings (stock channel, roll cooldown). *(Manage Server)*' },
        { name: '`/roll`',       value: 'Roll a random fruit with animated spin. Result saved to your inventory.' },
        { name: '`/trade`',      value: 'Post a trade and let the server vote W or L.' },
        { name: '`/inventory`',  value: 'View your fruit collection, sorted by rarity. Check others with `/inventory @user`.' },
        { name: '`/additem`',    value: 'Add any fruit to your inventory using rarity filter buttons + dropdown.' },
        { name: '`/removeitem`', value: 'Remove a fruit from your inventory via dropdown.' },
        { name: '`/minigame`',   value: 'Play Blox Fruits mini games: guess price, quiz, higher/lower, trivia.' },
        { name: '`/ai`',         value: 'Open a private AI-powered Blox Fruits helper channel.' },
        { name: '`/aiclose`',    value: 'Close and delete your private AI helper channel.' },
        { name: '`/ping`',       value: 'Check bot latency, API ping, uptime, and server count.' },
        { name: '`/help`',       value: 'Show this command list.' },
      )
      .setFooter({
        text: `Requested by ${interaction.user.username} • Each server has its own stock & inventories`,
        iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
      })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};
