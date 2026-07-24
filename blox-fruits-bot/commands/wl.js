const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require('discord.js');

const polls = new Map();

function buildEmbed(title, description, author, avatarURL, w, l) {
  const total = w + l;
  const wPct  = total ? Math.round((w / total) * 100) : 0;
  const lPct  = total ? 100 - wPct : 0;
  const bar   = total
    ? '🟩'.repeat(Math.round(wPct / 10)) + '⬛'.repeat(10 - Math.round(wPct / 10) - Math.round(lPct / 10)) + '🟥'.repeat(Math.round(lPct / 10))
    : '⬛'.repeat(10);

  const verdict = total
    ? w > l ? '📈 **Currently a W**' : w < l ? '📉 **Currently an L**' : '🤝 **Tied**'
    : '🗳️ **No votes yet**';

  return new EmbedBuilder()
    .setTitle(title || '🏆 W or L?')
    .setColor(w > l ? 0x57F287 : w < l ? 0xED4245 : 0xFFA500)
    .setDescription(description || '_No description provided_')
    .addFields(
      { name: '📊 Results',
        value: `${bar}\n✅ **W** ${w} (${wPct}%)  •  ❌ **L** ${l} (${lPct}%)`,
        inline: false,
      },
      { name: '🏆 Verdict', value: verdict, inline: false },
    )
    .setFooter({ text: `Posted by ${author} • Vote below!` })
    .setTimestamp();
}

function buildButtons(messageId) {
  const p = polls.get(messageId) ?? { w: new Set(), l: new Set() };
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`wl_w_${messageId}`).setLabel(`✅  W  (${p.w.size})`).setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`wl_l_${messageId}`).setLabel(`❌  L  (${p.l.size})`).setStyle(ButtonStyle.Danger),
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('wl')
    .setDescription('Post something and let the server vote: is it a W or an L?')
    .addStringOption(o => o
      .setName('title')
      .setDescription('Short title for what you\'re posting (e.g. "My Dragon pull", "This trade offer")')
      .setRequired(true))
    .addStringOption(o => o
      .setName('description')
      .setDescription('Details — what happened, what you got, what you traded, etc.')
      .setRequired(false))
    .addAttachmentOption(o => o
      .setName('image')
      .setDescription('Attach a screenshot or image to show')
      .setRequired(false)),

  async execute(interaction) {
    const title       = interaction.options.getString('title');
    const description = interaction.options.getString('description') ?? '';
    const attachment  = interaction.options.getAttachment('image');
    const author      = interaction.user.username;
    const avatarURL   = interaction.user.displayAvatarURL({ dynamic: true });

    const placeholder = interaction.id;
    polls.set(placeholder, { w: new Set(), l: new Set() });

    const embed = buildEmbed(title, description, author, avatarURL, 0, 0);
    if (attachment) embed.setImage(attachment.url);
    embed.setThumbnail(avatarURL);

    await interaction.reply({
      embeds: [embed],
      components: [buildButtons(placeholder)],
    });

    const message = await interaction.fetchReply();

    polls.set(message.id, polls.get(placeholder));
    polls.delete(placeholder);

    const collector = message.createMessageComponentCollector({ time: 24 * 60 * 60 * 1000 });

    collector.on('collect', async btn => {
      const parts = btn.customId.split('_');
      const side  = parts[1];
      const p     = polls.get(message.id);

      if (side === 'w') {
        p.l.delete(btn.user.id);
        p.w.has(btn.user.id) ? p.w.delete(btn.user.id) : p.w.add(btn.user.id);
      } else {
        p.w.delete(btn.user.id);
        p.l.has(btn.user.id) ? p.l.delete(btn.user.id) : p.l.add(btn.user.id);
      }

      const updated = buildEmbed(title, description, author, avatarURL, p.w.size, p.l.size);
      if (attachment) updated.setImage(attachment.url);
      updated.setThumbnail(avatarURL);

      await btn.update({
        embeds: [updated],
        components: [buildButtons(message.id)],
      });
    });

    collector.on('end', async () => {
      polls.delete(message.id);
      const p = { w: new Set(), l: new Set() };
      const final = buildEmbed(title, description, author, avatarURL, p.w.size, p.l.size);
      if (attachment) final.setImage(attachment.url);
      final.setThumbnail(avatarURL);
      await message.edit({ embeds: [final], components: [] }).catch(() => {});
    });
  },
};
