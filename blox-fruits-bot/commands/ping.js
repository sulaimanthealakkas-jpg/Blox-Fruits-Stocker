const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

function formatUptime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const days    = Math.floor(totalSeconds / 86400);
  const hours   = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts = [];
  if (days)    parts.push(`${days}d`);
  if (hours)   parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);
  return parts.join(' ');
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check bot status, latency, and info'),

  async execute(interaction) {
    const sent = await interaction.reply({ content: '🏓 Checking...', fetchReply: true });

    const botLatency = sent.createdTimestamp - interaction.createdTimestamp;
    const apiLatency = Math.round(interaction.client.ws.ping);
    const uptime     = formatUptime(interaction.client.uptime);
    const guilds     = interaction.client.guilds.cache.size;
    const commands   = interaction.client.commands.size;

    const latencyBar = botLatency < 100 ? '🟢 Great'
                     : botLatency < 250 ? '🟡 OK'
                     : '🔴 Slow';

    const embed = new EmbedBuilder()
      .setTitle('🤖 Blox Stock — Bot Status')
      .setColor(botLatency < 250 ? 0x57F287 : 0xED4245)
      .addFields(
        { name: '📡 Bot Latency',  value: `\`${botLatency}ms\` ${latencyBar}`, inline: true  },
        { name: '💙 API Latency',  value: `\`${apiLatency}ms\``,               inline: true  },
        { name: '\u200B',          value: '\u200B',                             inline: false },
        { name: '⏱️ Uptime',       value: `\`${uptime}\``,                     inline: true  },
        { name: '🌐 Servers',      value: `\`${guilds}\``,                      inline: true  },
        { name: '⚡ Commands',     value: `\`${commands}\``,                    inline: true  },
      )
      .setFooter({ text: 'Blox Fruits Stock Bot • All systems operational' })
      .setTimestamp();

    await interaction.editReply({ content: '', embeds: [embed] });
  },
};
