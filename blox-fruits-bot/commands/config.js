const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
  MessageFlags,
} = require('discord.js');
const { getConfig, setRollCooldown, setStockChannel } = require('../utils/configManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Configure bot settings for this server')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

    .addSubcommand(sub =>
      sub.setName('view')
        .setDescription('View current bot configuration'))

    .addSubcommand(sub =>
      sub.setName('rollcooldown')
        .setDescription('Set how many hours players must wait between /roll uses')
        .addNumberOption(opt =>
          opt.setName('hours')
            .setDescription('Cooldown in hours (e.g. 2, 0.5 for 30 min, 0 to disable)')
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(48)))

    .addSubcommand(sub =>
      sub.setName('stockchannel')
        .setDescription('Set the channel where automatic stock updates are posted')
        .addChannelOption(opt =>
          opt.setName('channel')
            .setDescription('Text channel for stock announcements')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true))),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const sub     = interaction.options.getSubcommand();

    // ── View ──────────────────────────────────────────────────────────────────
    if (sub === 'view') {
      const cfg = getConfig(guildId);
      const hours = cfg.rollCooldownHours;
      const cooldownDisplay = hours === 0
        ? '♾️ Disabled'
        : hours < 1
          ? `⏱️ ${hours * 60} minutes`
          : `⏱️ ${hours} hour${hours !== 1 ? 's' : ''}`;

      const stockCh = cfg.stockChannelId
        ? `<#${cfg.stockChannelId}>`
        : '_Not set — auto-stock updates disabled_';

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('⚙️ Server Configuration')
            .setColor(0x5865F2)
            .addFields(
              { name: '🎰 Roll Cooldown',   value: cooldownDisplay, inline: true },
              { name: '📢 Stock Channel',   value: stockCh,         inline: true },
            )
            .setFooter({ text: 'Use /config <setting> to change these' }),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    // ── Roll Cooldown ─────────────────────────────────────────────────────────
    if (sub === 'rollcooldown') {
      const hours = interaction.options.getNumber('hours');
      setRollCooldown(guildId, hours);

      const display = hours === 0
        ? 'disabled (no cooldown)'
        : hours < 1
          ? `${hours * 60} minutes`
          : `${hours} hour${hours !== 1 ? 's' : ''}`;

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('✅ Roll Cooldown Updated')
            .setColor(0x57F287)
            .setDescription(`Players must now wait **${display}** between rolls.`),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    // ── Stock Channel ─────────────────────────────────────────────────────────
    if (sub === 'stockchannel') {
      const channel = interaction.options.getChannel('channel');
      setStockChannel(guildId, channel.id);

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('✅ Stock Channel Set')
            .setColor(0x57F287)
            .setDescription(`Auto stock updates will be posted in ${channel}.\nThe bot will check fruityblox.com every **30 minutes** and update stock when it changes.`),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
