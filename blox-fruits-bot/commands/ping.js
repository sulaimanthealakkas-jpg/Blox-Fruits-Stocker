const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check the bot\'s response time'),

  async execute(interaction) {
    const sent = await interaction.reply({ content: '🏓 Pinging...', fetchReply: true });
    const latency = sent.createdTimestamp - interaction.createdTimestamp;
    const apiLatency = Math.round(interaction.client.ws.ping);

    const embed = new EmbedBuilder()
      .setTitle('🏓 Pong!')
      .setColor(0x00BFFF)
      .addFields(
        { name: '📡 Bot Latency', value: `\`${latency}ms\``, inline: true },
        { name: '💙 API Latency', value: `\`${apiLatency}ms\``, inline: true }
      )
      .setFooter({ text: 'Blox Fruits Stock Bot' })
      .setTimestamp();

    await interaction.editReply({ content: '', embeds: [embed] });
  },
};
