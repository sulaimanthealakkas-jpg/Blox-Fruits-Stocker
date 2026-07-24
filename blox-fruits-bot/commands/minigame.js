const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require('discord.js');
const allFruits         = require('../data/fruits.json');
const { getFruitEmoji } = require('../utils/emojiManager');

function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5); }

function rarityColor(rarity) {
  return { Common: 0x95A5A6, Uncommon: 0x2ECC71, Rare: 0x3498DB, Legendary: 0xF39C12, Mythical: 0xE74C3C }[rarity] || 0xFFA500;
}

async function playGuessPrice(interaction) {
  const fruit = rand(allFruits);
  const emoji = getFruitEmoji(fruit.name);

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setTitle('💰 Guess the Price!')
        .setDescription(
          `How much does ${emoji} **${fruit.name}** (${fruit.rarity}) cost in Beli?\n\n` +
          `> Type your guess in chat within **30 seconds!**`
        )
        .setColor(rarityColor(fruit.rarity))
        .setFooter({ text: 'Closest answer wins • Type a number in chat' }),
    ],
  });

  const filter = m => m.author.id === interaction.user.id && /^\d[\d,]*$/.test(m.content.trim());
  let collected;
  try {
    collected = await interaction.channel.awaitMessages({ filter, max: 1, time: 30_000, errors: ['time'] });
  } catch {
    return interaction.followUp({
      content: `⏰ Time's up! ${emoji} **${fruit.name}** costs **$${fruit.price.toLocaleString()}**.`,
    });
  }

  const guess    = parseInt(collected.first().content.replace(/,/g, ''), 10);
  const actual   = fruit.price;
  const diff     = Math.abs(guess - actual);
  const pct      = Math.round((diff / actual) * 100);

  let result, color;
  if (diff === 0)       { result = '🎯 **EXACT!** Perfect guess!';   color = 0xF1C40F; }
  else if (pct <= 5)    { result = '🔥 **So close!** Within 5%!';    color = 0x57F287; }
  else if (pct <= 20)   { result = '👍 **Pretty good!** Within 20%.'; color = 0x3498DB; }
  else if (pct <= 50)   { result = '😅 **Not bad.** Within 50%.';    color = 0xFFA500; }
  else                  { result = '💀 **Way off!** Better luck next time.'; color = 0xED4245; }

  const arrow = guess < actual ? '⬆️ Too low' : guess > actual ? '⬇️ Too high' : '✅ Exact';

  return interaction.followUp({
    embeds: [
      new EmbedBuilder()
        .setTitle(`${emoji} ${fruit.name} — Price Reveal!`)
        .setColor(color)
        .setDescription(result)
        .addFields(
          { name: 'Your Guess', value: `$${guess.toLocaleString()}`,  inline: true },
          { name: 'Actual Price', value: `$${actual.toLocaleString()}`, inline: true },
          { name: 'Off by',     value: `${arrow} ($${diff.toLocaleString()} / ${pct}%)`, inline: true },
        ),
    ],
  });
}

const QUIZ_QUESTIONS = [
  (f) => ({
    question: `What **rarity** is ${getFruitEmoji(f.name)} **${f.name}**?`,
    answer:   f.rarity,
    choices:  shuffle(['Common', 'Uncommon', 'Rare', 'Legendary', 'Mythical'].filter(r => r !== f.rarity).slice(0, 3).concat(f.rarity)),
  }),
  (f) => ({
    question: `What **type** is ${getFruitEmoji(f.name)} **${f.name}**?`,
    answer:   f.type,
    choices:  shuffle(['Natural', 'Elemental', 'Beast'].filter(t => t !== f.type).concat(f.type)),
  }),
  (f) => {
    const others = shuffle(allFruits.filter(x => x.name !== f.name)).slice(0, 3);
    const choices = shuffle([f, ...others]);
    return {
      question: `Which fruit costs **$${f.price.toLocaleString()}** Beli?`,
      answer:   f.name,
      choices:  choices.map(x => x.name),
    };
  },
  (f) => {
    const others = shuffle(allFruits.filter(x => x.name !== f.name)).slice(0, 3);
    const choices = shuffle([f.name, ...others.map(x => x.name)]);
    return {
      question: `${getFruitEmoji(f.name)} This is a **${f.rarity} ${f.type}** fruit costing **$${f.price.toLocaleString()}**. Which fruit is it?`,
      answer:   f.name,
      choices,
    };
  },
];

async function playQuiz(interaction) {
  const fruit    = rand(allFruits);
  const template = rand(QUIZ_QUESTIONS)(fruit);
  const { question, answer, choices } = template;

  const labels    = ['A', 'B', 'C', 'D'];

  const row = new ActionRowBuilder().addComponents(
    ...choices.slice(0, 4).map((c, i) =>
      new ButtonBuilder()
        .setCustomId(`quiz_${i}`)
        .setLabel(`${labels[i]}) ${c}`)
        .setStyle(ButtonStyle.Primary)
    )
  );

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setTitle('🧠 Blox Fruits Quiz!')
        .setDescription(question)
        .setColor(0x5865F2)
        .setFooter({ text: '⏱️ 20 seconds to answer' }),
    ],
    components: [row],
  });

  let btn;
  try {
    btn = await interaction.channel.awaitMessageComponent({
      filter: i => i.customId.startsWith('quiz_') && i.user.id === interaction.user.id,
      time: 20_000,
    });
  } catch {
    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xED4245)
          .setDescription(`⏰ Time's up! The answer was **${answer}**.`),
      ],
      components: [],
    });
  }

  const chosenIdx = parseInt(btn.customId.split('_')[1]);
  const chosen    = choices[chosenIdx];
  const correct   = chosen === answer;

  const revealRow = new ActionRowBuilder().addComponents(
    ...choices.slice(0, 4).map((c, i) => {
      const isCorrect = c === answer;
      const isPicked  = i === chosenIdx;
      let style = ButtonStyle.Secondary;
      if (isCorrect) style = ButtonStyle.Success;
      else if (isPicked) style = ButtonStyle.Danger;
      return new ButtonBuilder()
        .setCustomId(`quiz_done_${i}`)
        .setLabel(`${labels[i]}) ${c}`)
        .setStyle(style)
        .setDisabled(true);
    })
  );

  await btn.update({
    embeds: [
      new EmbedBuilder()
        .setTitle(correct ? '✅ Correct!' : '❌ Wrong!')
        .setColor(correct ? 0x57F287 : 0xED4245)
        .setDescription(
          correct
            ? `🎉 You got it! **${answer}** is correct.`
            : `The correct answer was **${answer}**.`
        ),
    ],
    components: [revealRow],
  });
}

async function playHigherLower(interaction) {
  const [fruitA, fruitB] = shuffle(allFruits).slice(0, 2);
  const emojiA = getFruitEmoji(fruitA.name);
  const emojiB = getFruitEmoji(fruitB.name);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('hl_higher').setLabel('⬆️  Higher').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('hl_lower') .setLabel('⬇️  Lower') .setStyle(ButtonStyle.Danger),
  );

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setTitle('📈 Higher or Lower?')
        .setColor(0xFFA500)
        .setDescription(
          `${emojiA} **${fruitA.name}** costs **$${fruitA.price.toLocaleString()}** Beli.\n\n` +
          `Is ${emojiB} **${fruitB.name}** (${fruitB.rarity}) **higher or lower** in price?`
        )
        .setFooter({ text: '⏱️ 15 seconds to answer' }),
    ],
    components: [row],
  });

  let btn;
  try {
    btn = await interaction.channel.awaitMessageComponent({
      filter: i => ['hl_higher', 'hl_lower'].includes(i.customId) && i.user.id === interaction.user.id,
      time: 15_000,
    });
  } catch {
    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xED4245)
          .setDescription(`⏰ Time's up! ${emojiB} **${fruitB.name}** costs **$${fruitB.price.toLocaleString()}**.`),
      ],
      components: [],
    });
  }

  const guessedHigher = btn.customId === 'hl_higher';
  const isHigher      = fruitB.price > fruitA.price;
  const isSame        = fruitB.price === fruitA.price;
  const correct       = isSame || (guessedHigher === isHigher);

  const actualLabel = isSame
    ? `Same price — both cost $${fruitA.price.toLocaleString()}`
    : `${emojiB} **${fruitB.name}** costs **$${fruitB.price.toLocaleString()}** (${isHigher ? '⬆️ Higher' : '⬇️ Lower'})`;

  await btn.update({
    embeds: [
      new EmbedBuilder()
        .setTitle(correct ? '✅ Correct!' : '❌ Wrong!')
        .setColor(correct ? 0x57F287 : 0xED4245)
        .setDescription(actualLabel)
        .addFields(
          { name: `${emojiA} ${fruitA.name}`, value: `$${fruitA.price.toLocaleString()}`, inline: true },
          { name: `${emojiB} ${fruitB.name}`, value: `$${fruitB.price.toLocaleString()}`, inline: true },
        ),
    ],
    components: [],
  });
}

const FUN_FACTS = [
  { q: 'Which fruit is the rarest and most expensive to buy?',          a: 'Leopard',  choices: ['Dragon', 'Kitsune', 'Leopard', 'Dough'] },
  { q: 'Which fruit is considered the best for grinding in Blox Fruits?', a: 'Buddha',   choices: ['Buddha', 'Flame', 'Dragon', 'Light'] },
  { q: 'Which fruit is classified as Elemental AND Legendary?',          a: 'Rumble',   choices: ['Gas', 'Rumble', 'Smoke', 'Magma'] },
  { q: 'What is the cheapest fruit you can buy from the dealer?',        a: 'Bomb',     choices: ['Kilo', 'Bomb', 'Spike', 'Spin'] },
  { q: 'Which fruit type makes you immune to non-Elemental attacks?',    a: 'Elemental',choices: ['Beast', 'Natural', 'Elemental', 'Mythical'] },
  { q: 'Which dealer sells Legendary and Mythical fruits?',              a: 'Mirage',   choices: ['Normal', 'Mirage', 'Dark', 'Black Market'] },
  { q: 'How often does the Normal dealer stock rotate?',                  a: 'Every 4 hours', choices: ['Every 1 hour', 'Every 2 hours', 'Every 4 hours', 'Every 8 hours'] },
  { q: 'How often does the Mirage dealer stock rotate?',                  a: 'Every 2 hours', choices: ['Every 30 min', 'Every 1 hour', 'Every 2 hours', 'Every 6 hours'] },
  { q: 'Which fruit allows you to transform into a giant golden Buddha?', a: 'Buddha',   choices: ['Kitsune', 'Buddha', 'Dragon', 'Phoenix'] },
  { q: 'Which Mythical fruit is shaped like a fox?',                      a: 'Kitsune',  choices: ['Leopard', 'Dragon', 'Kitsune', 'Phoenix'] },
  { q: 'Which fruit is best known for its room ability and teleportation?', a: 'Control', choices: ['Portal', 'Control', 'Shadow', 'Ghost'] },
  { q: 'What Sea do you need to be in to use the Mirage dealer?',         a: 'Second/Third Sea', choices: ['First Sea', 'Second/Third Sea', 'Any Sea', 'Fourth Sea'] },
];

async function playTrivia(interaction) {
  const q = rand(FUN_FACTS);
  const choices = shuffle(q.choices);

  const row = new ActionRowBuilder().addComponents(
    ...choices.slice(0, 4).map((c, i) =>
      new ButtonBuilder()
        .setCustomId(`trivia_${i}`)
        .setLabel(`${['A','B','C','D'][i]}) ${c}`)
        .setStyle(ButtonStyle.Primary)
    )
  );

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setTitle('🎓 Blox Fruits Trivia!')
        .setDescription(q.q)
        .setColor(0x9B59B6)
        .setFooter({ text: '⏱️ 20 seconds to answer' }),
    ],
    components: [row],
  });

  let btn;
  try {
    btn = await interaction.channel.awaitMessageComponent({
      filter: i => i.customId.startsWith('trivia_') && i.user.id === interaction.user.id,
      time: 20_000,
    });
  } catch {
    return interaction.editReply({
      embeds: [new EmbedBuilder().setColor(0xED4245).setDescription(`⏰ Time's up! The answer was **${q.a}**.`)],
      components: [],
    });
  }

  const chosenIdx = parseInt(btn.customId.split('_')[1]);
  const chosen    = choices[chosenIdx];
  const correct   = chosen === q.a;

  const revealRow = new ActionRowBuilder().addComponents(
    ...choices.slice(0, 4).map((c, i) => {
      const isAns = c === q.a;
      const isPick = i === chosenIdx;
      return new ButtonBuilder()
        .setCustomId(`trivia_done_${i}`)
        .setLabel(`${['A','B','C','D'][i]}) ${c}`)
        .setStyle(isAns ? ButtonStyle.Success : isPick ? ButtonStyle.Danger : ButtonStyle.Secondary)
        .setDisabled(true);
    })
  );

  await btn.update({
    embeds: [
      new EmbedBuilder()
        .setTitle(correct ? '✅ Correct!' : '❌ Wrong!')
        .setColor(correct ? 0x57F287 : 0xED4245)
        .setDescription(correct ? `🎉 **${q.a}** is right!` : `The answer was **${q.a}**.`),
    ],
    components: [revealRow],
  });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('minigame')
    .setDescription('Play a Blox Fruits mini game!')
    .addSubcommand(sub =>
      sub.setName('guessprice')
        .setDescription('Guess a fruit\'s Beli price — type your answer in chat'))
    .addSubcommand(sub =>
      sub.setName('quiz')
        .setDescription('4-choice quiz: rarity, type, or price of a random fruit'))
    .addSubcommand(sub =>
      sub.setName('higherlower')
        .setDescription('Is the second fruit\'s price Higher or Lower?'))
    .addSubcommand(sub =>
      sub.setName('trivia')
        .setDescription('Blox Fruits knowledge trivia — answer 4 choices')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'guessprice')  return playGuessPrice(interaction);
    if (sub === 'quiz')        return playQuiz(interaction);
    if (sub === 'higherlower') return playHigherLower(interaction);
    if (sub === 'trivia')      return playTrivia(interaction);
  },
};
