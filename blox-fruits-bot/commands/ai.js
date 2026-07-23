const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField,
  ChannelType,
  MessageFlags,
} = require('discord.js');
const { findUserAiChannel, registerAiChannel } = require('../utils/configManager');

// Sanitise usernames for channel names (Discord allows a-z, 0-9, hyphens)
function safeChannelName(username) {
  return username.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 20);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ai')
    .setDescription('Open a private AI-powered Blox Fruits helper channel just for you'),

  async execute(interaction) {
    const { guild, user } = interaction;

    // ── Check if user already has an AI channel ───────────────────────────────
    const existingId = findUserAiChannel(guild.id, user.id);
    if (existingId) {
      const existing = guild.channels.cache.get(existingId);
      if (existing) {
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x5865F2)
              .setDescription(`🤖 You already have an AI channel: ${existing}\nHead over there to keep chatting!`),
          ],
          flags: MessageFlags.Ephemeral,
        });
      }
      // Channel was deleted — fall through to create a new one
    }

    // ── Show the "Start AI Session" button prompt ─────────────────────────────
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('ai_start')
        .setLabel('🤖  Start AI Session')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('ai_cancel')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary),
    );

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('🤖 Blox Fruits AI Helper')
          .setColor(0x5865F2)
          .setDescription(
            'Get a **private channel** where you can ask the AI anything about Blox Fruits:\n\n' +
            '🍎 Fruit prices, types & rarities\n' +
            '🏆 Best fruits for grinding & PvP\n' +
            '💰 Trading values & tier lists\n' +
            '⚡ Awakening & fragments guide\n' +
            '🗺️ Sea progression tips\n\n' +
            'Click the button below to open your personal AI channel!'
          )
          .setFooter({ text: 'Only you and the bot can see the channel' }),
      ],
      components: [row],
      flags: MessageFlags.Ephemeral,
    });

    // ── Wait for button click ─────────────────────────────────────────────────
    let btn;
    try {
      btn = await interaction.channel.awaitMessageComponent({
        filter: i => ['ai_start', 'ai_cancel'].includes(i.customId) && i.user.id === user.id,
        time: 60_000,
      });
    } catch {
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(0xED4245).setDescription('⏱️ Timed out.')], components: [] });
    }

    if (btn.customId === 'ai_cancel') {
      return btn.update({ embeds: [new EmbedBuilder().setColor(0x99AAB5).setDescription('Cancelled.')], components: [] });
    }

    await btn.update({ embeds: [new EmbedBuilder().setColor(0x5865F2).setDescription('⏳ Creating your private AI channel...')], components: [] });

    // ── Create private channel ────────────────────────────────────────────────
    let aiChannel;
    try {
      // Find or create an "AI Helpers" category for cleanliness (optional)
      let category = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === '🤖 AI Helper');

      aiChannel = await guild.channels.create({
        name: `🤖-ai-${safeChannelName(user.username)}`,
        type: ChannelType.GuildText,
        parent: category?.id ?? null,
        topic: `Private Blox Fruits AI session for ${user.username}`,
        permissionOverwrites: [
          // @everyone cannot see it
          { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
          // The user can read & write
          {
            id: user.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory,
            ],
          },
          // Bot gets full control
          {
            id: guild.members.me.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory,
              PermissionsBitField.Flags.ManageMessages,
              PermissionsBitField.Flags.ManageChannels,
            ],
          },
        ],
      });
    } catch (err) {
      console.error('[AI] Channel creation failed:', err.message);
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xED4245)
            .setDescription('❌ Could not create the AI channel. Make sure I have **Manage Channels** permission.'),
        ],
        components: [],
      });
    }

    // ── Register the channel in config ────────────────────────────────────────
    registerAiChannel(guild.id, aiChannel.id, user.id);

    // ── Send greeting in the new channel ──────────────────────────────────────
    const hasKey = !!process.env.OPENAI_API_KEY;
    await aiChannel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle('👋 Hello!')
          .setColor(0x5865F2)
          .setDescription(
            `Hey ${user}! I'm **BloxBot**, your personal Blox Fruits AI assistant! 🍎\n\n` +
            `I know everything about Blox Fruits — fruit prices, best picks for grinding and PvP, ` +
            `trading values, awakening guides, sea progression, and more.\n\n` +
            `**Just type your question here and I'll answer!**\n\n` +
            (hasKey
              ? '✅ AI is fully powered up and ready!'
              : '⚠️ *Running in knowledge-base mode. For full AI, add `OPENAI_API_KEY` to Replit Secrets.*')
          )
          .addFields(
            { name: '💡 Try asking...', value:
              '• "What\'s the best fruit for grinding?"\n' +
              '• "How much does Dragon cost?"\n' +
              '• "How do I get to the Second Sea?"\n' +
              '• "Is Dough good for PvP?"\n' +
              '• "How many fragments to awaken Buddha?"'
            },
          )
          .setFooter({ text: 'Type /ai close to delete this channel when you\'re done' }),
      ],
    });

    // ── Update the original reply ─────────────────────────────────────────────
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x57F287)
          .setDescription(`✅ Your AI channel is ready: ${aiChannel}\nHead over there to start chatting!`),
      ],
      components: [],
    });
  },
};
