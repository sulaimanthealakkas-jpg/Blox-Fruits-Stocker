const { isAiChannel } = require('../utils/configManager');
const { askAI }       = require('../utils/aiHelper');

module.exports = {
  name: 'messageCreate',
  once: false,

  async execute(message, client) {
    // Ignore bots and DMs
    if (message.author.bot || !message.guild) return;

    const guildId   = message.guild.id;
    const channelId = message.channel.id;

    // Only handle messages in registered AI channels
    if (!isAiChannel(guildId, channelId)) return;

    // Ignore very short non-meaningful input
    const content = message.content.trim();
    if (!content || content.startsWith('/')) return;

    // Show typing indicator while we think
    try { await message.channel.sendTyping(); } catch {}

    try {
      const reply = await askAI(channelId, content);

      // Split long responses to avoid 2000-char Discord limit
      if (reply.length <= 2000) {
        await message.reply(reply);
      } else {
        const chunks = splitMessage(reply, 1900);
        for (const chunk of chunks) {
          await message.channel.send(chunk);
        }
      }
    } catch (err) {
      console.error('[AI] messageCreate error:', err.message);
      await message.reply('❌ Something went wrong. Please try again!').catch(() => {});
    }
  },
};

function splitMessage(text, maxLen) {
  const chunks = [];
  let current  = '';
  for (const line of text.split('\n')) {
    if (current.length + line.length + 1 > maxLen) {
      chunks.push(current);
      current = '';
    }
    current += (current ? '\n' : '') + line;
  }
  if (current) chunks.push(current);
  return chunks;
}
