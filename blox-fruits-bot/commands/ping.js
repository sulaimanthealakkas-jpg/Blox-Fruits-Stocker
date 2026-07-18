const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

function formatUptime(ms) {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  parts.push(`${s % 60}s`);
  return parts.join(' ');
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check bot status, latency, and info'),

  async execute(interaction) {
    await interaction.reply({ content: '🏓 Checking...' });
    const sent       = await interaction.fetchReply();
    const botLatency = sent.createdTimestamp - interaction.createdTimestamp;
    const apiLatency = Math.round(interaction.client.ws.ping);
    const uptime     = formatUptime(interaction.client.uptime);
    const guilds     = interaction.client.guilds.cache.size;
    const commands   = interaction.client.commands.size;
    const bar        = botLatency < 100 ? '🟢 Great' : botLatency < 250 ? '🟡 OK' : '🔴 Slow';

    const embed = new EmbedBuilder()
      .setTitle('🤖 Blox Stock — Bot Status')
      .setColor(botLatency < 250 ? 0x57F287 : 0xED4245)
      .addFields(
        { name: '📡 Bot Latency', value: `\`${botLatency}ms\` ${bar}`, inline: true },
        { name: '💙 API Latency', value: `\`${apiLatency}ms\``,         inline: true },
        { name: '\u200B',         value: '\u200B',                       inline: false },
        { name: '⏱️ Uptime',      value: `\`${uptime}\``,               inline: true },
        { name: '🌐 Servers',     value: `\`${guilds}\``,                inline: true },
        { name: '⚡ Commands',    value: `\`${commands}\``,              inline: true },
      )
      .setFooter({ text: 'Blox Fruits Stock Bot • All systems operational' })
      .setTimestamp();

    await interaction.editReply({ content: '', embeds: [embed] });
  },
};
