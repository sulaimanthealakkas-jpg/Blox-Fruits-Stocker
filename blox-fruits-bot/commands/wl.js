const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const allFruits         = require('../data/fruits.json');
const { getFruitEmoji } = require('../utils/emojiManager');

const RARITY_VALUE = {
  Common: 1,
  Uncommon: 2,
  Rare: 3,
  Legendary: 4,
  Mythical: 5,
};

function findFruit(name) {
  const lower = name.toLowerCase().trim();
  return allFruits.find(f => f.name.toLowerCase() === lower);
}

function parseFruits(input) {
  return input
    .split(/[+,]/)
    .map(s => s.trim())
    .filter(Boolean)
    .map(name => {
      const fruit = findFruit(name);
      return fruit
        ? { name: fruit.name, fruit, valid: true }
        : { name, fruit: null, valid: false };
    });
}

function totalValue(items) {
  return items.reduce((sum, item) => {
    if (!item.fruit) return sum;
    return sum + item.fruit.price;
  }, 0);
}

function totalRarityScore(items) {
  return items.reduce((sum, item) => {
    if (!item.fruit) return sum;
    return sum + RARITY_VALUE[item.fruit.rarity];
  }, 0);
}

function formatSide(items) {
  return items.map(item => {
    if (!item.valid) return `❌ ~~${item.name}~~ (not found)`;
    const f = item.fruit;
    return `${getFruitEmoji(f.name)} **${f.name}**\n　${f.rarity} ${f.type} • 💰 $${f.price.toLocaleString()} • 💎 R$${f.robuxPrice.toLocaleString()}`;
  }).join('\n');
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('wl')
    .setDescription('Evaluate a trade — is it a W (win) or L (lose)?')
    .addStringOption(o => o
      .setName('giving')
      .setDescription('Fruit(s) you are giving (separate with + or commas). e.g. "Dragon" or "Kitsune + Dough"')
      .setRequired(true))
    .addStringOption(o => o
      .setName('receiving')
      .setDescription('Fruit(s) you are receiving (separate with + or commas). e.g. "Leopard" or "Venom + Shadow"')
      .setRequired(true)),

  async execute(interaction) {
    const givingInput    = interaction.options.getString('giving');
    const receivingInput  = interaction.options.getString('receiving');

    const giving    = parseFruits(givingInput);
    const receiving = parseFruits(receivingInput);

    const invalidGive = giving.filter(i => !i.valid);
    const invalidRecv = receiving.filter(i => !i.valid);

    if (invalidGive.length || invalidRecv.length) {
      const problems = [];
      if (invalidGive.length)   problems.push(`Could not find: ${invalidGive.map(i => `\`${i.name}\``).join(', ')}`);
      if (invalidRecv.length)   problems.push(`Could not find: ${invalidRecv.map(i => `\`${i.name}\``).join(', ')}`);
      problems.push('Make sure fruit names match exactly (e.g. "T-Rex", "Dough", "Kitsune").');
      return interaction.reply({
        content: `❌ **Invalid fruit name(s)**\n${problems.join('\n')}`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const giveValue    = totalValue(giving);
    const recvValue    = totalValue(receiving);
    const giveRarity   = totalRarityScore(giving);
    const recvRarity   = totalRarityScore(receiving);

    const diff      = recvValue - giveValue;
    const diffPct   = giveValue > 0 ? Math.round((diff / giveValue) * 100) : 0;
    const isW       = diff > 0;
    const isFair    = diff === 0;

    let verdict, color, emoji;
    if (isFair) {
      verdict = '🤝 **FAIR TRADE** — Both sides are equal in value.';
      color   = 0xFFA500;
      emoji   = '🤝';
    } else if (isW) {
      verdict = `✅ **W (WIN)** — You're getting **$${Math.abs(diff).toLocaleString()}** more in value!`;
      color   = 0x57F287;
      emoji   = '✅';
    } else {
      verdict = `❌ **L (LOSE)** — You're losing **$${Math.abs(diff).toLocaleString()}** in value!`;
      color   = 0xED4245;
      emoji   = '❌';
    }

    const giveText = formatSide(giving);
    const recvText = formatSide(receiving);

    const bar = (() => {
      if (giveValue === 0 && recvValue === 0) return '⬛'.repeat(10);
      const total = giveValue + recvValue;
      const recvBars = Math.max(1, Math.round((recvValue / total) * 10));
      const giveBars = 10 - recvBars;
      return '🟩'.repeat(recvBars) + '🟥'.repeat(giveBars);
    })();

    const embed = new EmbedBuilder()
      .setTitle(`${emoji}  Trade Evaluation — ${isFair ? 'FAIR' : isW ? 'W' : 'L'}`)
      .setColor(color)
      .setDescription(verdict)
      .addFields(
        { name: '📤 You Give',    value: giveText, inline: true },
        { name: '📥 You Receive', value: recvText, inline: true },
        { name: '\u200B',          value: '\u200B', inline: false },
        { name: '📊 Value Comparison',
          value: `${bar}\n\n💰 **You give:** $${giveValue.toLocaleString()}\n💰 **You get:** $${recvValue.toLocaleString()}\n📈 **Difference:** ${diff >= 0 ? '+' : ''}$${diff.toLocaleString()} (${diffPct >= 0 ? '+' : ''}${diffPct}%)`,
          inline: false,
        },
        { name: '🌟 Rarity Score',
          value: `**Your side:** ${giveRarity}  •  **Their side:** ${recvRarity}`,
          inline: false,
        },
      )
      .setFooter({ text: `Evaluated by ${interaction.user.username} • Values based on Blox Fruits Fandom wiki prices` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
