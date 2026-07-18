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
        {
          name: '`/stock [type]`',
          value: 'View fruit stock.\n**Choices:** `normal` · `mirage` · `all` *(default)*',
        },
        {
          name: '`/ping`',
          value: 'Check the bot\'s response time.',
        },
        {
          name: '`/help`',
          value: 'Show this command list.',
        }
      )
      .setFooter({
        text: `Requested by ${interaction.user.username}`,
        iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
      })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
