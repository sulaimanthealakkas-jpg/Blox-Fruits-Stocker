const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { getAiChannelUser, unregisterAiChannel } = require('../utils/configManager');
const { clearHistory } = require('../utils/aiHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('aiclose')
    .setDescription('Close and delete your private AI helper channel'),

  async execute(interaction) {
    const { guild, user, channel } = interaction;
    const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.ManageChannels);

    const ownerId = getAiChannelUser(guild.id, channel.id);

    if (!ownerId) {
      return interaction.reply({
        content: '❌ This command can only be used inside your AI helper channel.',
        flags: MessageFlags.Ephemeral,
      });
    }

    if (ownerId !== user.id && !isAdmin) {
      return interaction.reply({
        content: '❌ Only the channel owner or an admin can close this channel.',
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xED4245)
          .setDescription('👋 Goodbye! Closing this AI session in **3 seconds**...'),
      ],
    });

    clearHistory(channel.id);
    unregisterAiChannel(guild.id, channel.id);

    setTimeout(async () => {
      try { await channel.delete('AI session closed'); }
      catch (e) { console.warn('[AI] Could not delete channel:', e.message); }
    }, 3000);
  },
};
