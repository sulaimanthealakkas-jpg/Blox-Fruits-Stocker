const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');

const votes = new Map();

function buildEmbed(offering, looking, author, w, l) {
  const total = w + l;
  const wPct  = total ? Math.round((w / total) * 100) : 0;
  const lPct  = total ? 100 - wPct : 0;
  const bar   = total
    ? '🟩'.repeat(Math.round(wPct / 10)) + '🟥'.repeat(Math.round(lPct / 10))
    : '⬛'.repeat(10);

  return new EmbedBuilder()
    .setTitle('🔄 Trade Post')
    .setColor(w >= l ? 0x57F287 : 0xED4245)
    .addFields(
      { name: '📤 Offering',    value: `\`\`\`${offering}\`\`\``, inline: true },
      { name: '📥 Looking For', value: `\`\`\`${looking}\`\`\``,  inline: true },
      { name: '\u200B', value: '\u200B', inline: false },
      { name: '📊 Votes',
        value: `${bar}\n✅ **W** ${w} vote${w !== 1 ? 's' : ''} (${wPct}%)  |  ❌ **L** ${l} vote${l !== 1 ? 's' : ''} (${lPct}%)`,
      },
    )
    .setFooter({ text: `Posted by ${author} • Click to vote` })
    .setTimestamp();
}

function buildButtons(messageId) {
  const v = votes.get(messageId) ?? { w: new Set(), l: new Set() };
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`trade_w_${messageId}`).setLabel(`✅  W  (${v.w.size})`).setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`trade_l_${messageId}`).setLabel(`❌  L  (${v.l.size})`).setStyle(ButtonStyle.Danger),
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('trade')
    .setDescription('Post a trade and let the server vote W or L')
    .addStringOption(o => o.setName('offering').setDescription('What you are offering').setRequired(true))
    .addStringOption(o => o.setName('looking').setDescription('What you are looking for').setRequired(true)),

  async execute(interaction) {
    const offering = interaction.options.getString('offering');
    const looking  = interaction.options.getString('looking');
    const author   = interaction.user.username;
    const placeholder = interaction.id;

    votes.set(placeholder, { w: new Set(), l: new Set() });

    await interaction.reply({
      embeds: [buildEmbed(offering, looking, author, 0, 0)],
      components: [buildButtons(placeholder)],
    });

    const message = await interaction.fetchReply();

    votes.set(message.id, votes.get(placeholder));
    votes.delete(placeholder);

    const collector = message.createMessageComponentCollector({ time: 24 * 60 * 60 * 1000 });

    collector.on('collect', async btn => {
      const parts = btn.customId.split('_');
      const side  = parts[1]; // 'w' or 'l'
      const v     = votes.get(message.id);

      if (side === 'w') {
        v.l.delete(btn.user.id);
        v.w.has(btn.user.id) ? v.w.delete(btn.user.id) : v.w.add(btn.user.id);
      } else {
        v.w.delete(btn.user.id);
        v.l.has(btn.user.id) ? v.l.delete(btn.user.id) : v.l.add(btn.user.id);
      }

      await btn.update({
        embeds: [buildEmbed(offering, looking, author, v.w.size, v.l.size)],
        components: [buildButtons(message.id)],
      });
    });

    collector.on('end', () => votes.delete(message.id));
  },
};
