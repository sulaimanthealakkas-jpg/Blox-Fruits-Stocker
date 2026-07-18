const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const commands = [
  {
    name: '/stock',
    description: 'View the current Blox Fruits stock',
    usage: '/stock [type]',
    example: '/stock type:mirage',
  },
  {
    name: '/ping',
    description: 'Check the bot\'s latency and response time',
    usage: '/ping',
    example: '/ping',
  },
  {
    name: '/help',
    description: 'Show this help menu with all available commands',
    usage: '/help',
    example: '/help',
  },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('View all available bot commands'),

  async execute(interaction) {
    const fields = commands.map((cmd) => ({
      name: cmd.name,
      value: [
        `📝 ${cmd.description}`,
        `**Usage:** \`${cmd.usage}\``,
        `**Example:** \`${cmd.example}\``,
      ].join('\n'),
      inline: false,
    }));

    const embed = new EmbedBuilder()
      .setTitle('📖 Blox Fruits Stock Bot — Help')
      .setDescription(
        'A bot that tracks Blox Fruits stock from both the **Normal** and **Mirage** dealers.\n\u200B'
      )
      .addFields(...fields)
      .setColor(0x7C3AED)
      .setFooter({
        text: `Requested by ${interaction.user.username}`,
        iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
      })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
