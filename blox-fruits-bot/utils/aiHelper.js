const OpenAI = require('openai');

const histories = new Map();
const MAX_HISTORY = 20;

function getHistory(channelId) {
  if (!histories.has(channelId)) histories.set(channelId, []);
  return histories.get(channelId);
}

function clearHistory(channelId) {
  histories.delete(channelId);
}

let openaiClient = null;

function getClient() {
  if (openaiClient) return openaiClient;
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  openaiClient = new OpenAI({ apiKey: key });
  return openaiClient;
}

const SYSTEM_PROMPT = `You are BloxBot, an expert Blox Fruits AI assistant built into a Discord bot. You know everything about the Roblox game "Blox Fruits". Be friendly, helpful, and concise. Use emojis occasionally for personality.

ALL FRUITS & PRICES (Beli / Robux):

COMMON: Bomb $5,000/R$50, Spike $7,500/R$50, Chop $30,000/R$100, Spring $60,000/R$180, Kilo $5,000/R$50, Spin $7,500/R$95, Smoke $100,000/R$250

UNCOMMON: Falcon $300,000/R$650, Flame $250,000/R$550, Ice $350,000/R$750, Revive $550,000/R$975, Sand $420,000/R$900, Dark $500,000/R$950, Diamond $600,000/R$1,000, Rubber $750,000/R$1,200, Magma $850,000/R$1,300

RARE: Light $650,000/R$1,100, Love $1,200,000/R$1,500, Quake $1,000,000/R$1,500, Buddha $1,500,000/R$1,700, Spider $1,500,000/R$1,800, Barrier $800,000/R$1,250, Ghost $940,000/R$1,350, Soul $1,600,000/R$1,900

LEGENDARY: Gravity $2,500,000/R$2,100, Dough $2,800,000/R$2,300, Shadow $2,900,000/R$2,300, Venom $3,000,000/R$2,450, Control $3,000,000/R$2,450, Rumble $2,100,000/R$2,100, Phoenix $1,800,000/R$2,000, Blizzard $2,500,000/R$2,100, Pain $2,900,000/R$2,350, Portal $2,700,000/R$2,200, Paw $2,300,000/R$2,000, Sound $2,200,000/R$2,050, Gas $2,900,000/R$2,300, T-Rex $2,500,000/R$2,100

MYTHICAL: Dragon $3,500,000/R$2,600, Leopard $5,000,000/R$3,000, Kitsune $4,800,000/R$2,800

TIER LIST:
S-Tier: Leopard, Dragon, Kitsune, Dough
A-Tier: Control, Shadow, Venom, Pain, Portal

Best Grinding: Buddha, Dragon, Dough, Magma, Flame, Ice
Best PvP: Leopard, Dough, Dragon, Control, Kitsune
Budget: Flame, Ice, Light, Magma, Buddha

SEA PROGRESSION:
First Sea: Level 1-700
Second Sea: Level 700-1500 (Mirage dealer available)
Third Sea: Level 1500+ (endgame)

AWAKENING: Most fruits cost 14,500 fragments. Dough/Spider/Control/Venom/Sound/Pain cost 18,500. Dragon/Leopard/Kitsune cost 20,000.

STOCK DEALERS:
Normal Dealer: Rotates every 4 hours. Common/Uncommon/Rare.
Mirage Dealer: Rotates every 2 hours. Legendary/Mythical. Second/Third Sea only.

Instructions: Answer questions about Blox Fruits concisely and accurately. If asked about current stock, remind them to use /stock in the server. For questions outside Blox Fruits, politely steer back. Be warm and encouraging. Keep responses under 400 words unless a detailed guide is needed.`;

async function askAI(channelId, userMessage) {
  const client = getClient();

  if (!client) {
    return noKeyResponse(userMessage);
  }

  const history = getHistory(channelId);
  history.push({ role: 'user', content: userMessage });

  while (history.length > MAX_HISTORY) history.shift();

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...history,
      ],
      max_tokens: 600,
      temperature: 0.7,
    });

    const reply = response.choices[0]?.message?.content?.trim() || 'Sorry, I couldn\'t generate a response.';

    history.push({ role: 'assistant', content: reply });

    return reply;
  } catch (err) {
    console.error('[AI] OpenAI error:', err.message);
    if (err.status === 401) {
      return '❌ Invalid OpenAI API key. Please ask an admin to check the OPENAI_API_KEY secret in Replit.';
    }
    if (err.status === 429) {
      return '⏳ Rate limit hit — please wait a moment and try again!';
    }
    return '❌ Something went wrong reaching the AI. Try again in a moment.';
  }
}

function noKeyResponse(message) {
  const m = message.toLowerCase();

  if (/price|cost|how much|beli|robux/.test(m)) {
    const fruit = findFruitInMessage(m);
    if (fruit) {
      return `💰 **${fruit.name}** costs **$${fruit.price.toLocaleString()} Beli** (R$${fruit.robuxPrice.toLocaleString()} Robux).\n> ${fruit.rarity} ${fruit.type} fruit.`;
    }
    return '💰 I can look up prices! Ask something like "how much does Dragon cost?" or check /inventory and /stock in this server.';
  }

  if (/best.*grind|grind.*best|grinding/.test(m)) {
    return '🏆 **Best grinding fruits:**\n1. **Buddha** – #1 for grinding, huge AoE in transform\n2. **Dragon** – Tanky & great AoE\n3. **Dough** – Excellent damage and AoE\n4. **Magma** – Great budget option\n5. **Flame** – Good for early game\n\nBuddha is the grinder\'s best friend!';
  }

  if (/best.*pvp|pvp.*best|fighting/.test(m)) {
    return '⚔️ **Best PvP fruits:**\n1. **Leopard** – Absolute best in PvP\n2. **Dough** – Bread combos are lethal\n3. **Dragon** – Tanky and high damage\n4. **Control** – Hard to avoid Gamma Rush\n5. **Kitsune** – Strong burst\n\nFor PvP, master your combos and use a good sword alongside your fruit!';
  }

  if (/mythical|legendary|rarest|strongest/.test(m)) {
    return '🌟 **Mythical fruits** (rarest tier):\n• 🐉 **Dragon** – $3.5M / R$2,600\n• 🐆 **Leopard** – $5M / R$3,000 *(most expensive!)*\n• 🦊 **Kitsune** – $4.8M / R$2,800\n\nLeopard is widely considered the best overall fruit in the game!';
  }

  if (/stock|dealer|mirage|rotate|rotation/.test(m)) {
    return '📦 **Stock info:**\n• **Normal Dealer** – Rotates every **4 hours**. Common/Uncommon/Rare fruits.\n• **Mirage Dealer** – Rotates every **2 hours**. Legendary/Mythical fruits. Only in 2nd/3rd Sea.\n\nUse /stock in this server to see what\'s in stock right now!';
  }

  if (/second sea|third sea|sea.*progression|how.*progress/.test(m)) {
    return '🗺️ **Sea Progression:**\n• **First Sea** – Level 1-700\n• **Second Sea** – Level 700-1500 (defeat Rayleigh to unlock)\n• **Third Sea** – Level 1500+ (endgame content)\n\nThe Mirage dealer only appears in 2nd and 3rd Sea!';
  }

  if (/awaken|awakening|fragment/.test(m)) {
    return '⚡ **Awakening:**\nMost fruits can be awakened using **Fragments** (earned from Raids and Sea Beasts).\n• Most fruits cost **14,500 fragments** to fully awaken\n• Dough, Spider, Control, etc. cost **18,500 fragments**\n• Dragon, Leopard, Kitsune cost **20,000 fragments**\n\nBuddha awakening is the most important — it unlocks endgame grinding!';
  }

  if (/trade|trading|worth/.test(m)) {
    const fruit = findFruitInMessage(m);
    if (fruit) {
      return `🔄 **${fruit.name}** trading value:\nIt\'s a ${fruit.rarity} fruit priced at $${fruit.price.toLocaleString()} in-game. Trading values fluctuate — ${fruit.rarity} fruits trade at roughly their rarity tier. Check a trading server for exact current values!`;
    }
    return '🔄 Trading values fluctuate based on demand. Generally: Leopard > Dragon > Kitsune > Dough > Control > Venom > Portal > Gravity > Rumble > Buddha > Soul. Perm (permanent) fruits are worth much more than regular!';
  }

  if (/budget|cheap|afford|starter|beginner|new.*player/.test(m)) {
    return '💡 **Budget recommendations:**\n• **Flame** ($250k) – Great early-game elemental\n• **Ice** ($350k) – Immunity + stuns, very useful\n• **Light** ($650k) – Fast travel with flight\n• **Magma** ($850k) – Best bang for the buck at this tier\n• **Buddha** ($1.5M) – Save up for this — it\'s the most important grind fruit!';
  }

  if (/hello|hi|hey|what.*you|who.*you/.test(m)) {
    return '👋 Hello! I\'m **BloxBot**, your Blox Fruits AI assistant!\n\nI know everything about:\n🍎 All 41 fruits — prices, types, rarities\n🏆 Best fruits for grinding & PvP\n🗺️ Sea progression tips\n⚡ Awakening & fragments\n💰 Trading values\n\nAsk me anything about Blox Fruits! What do you want to know?';
  }

  return '🤖 I can help with Blox Fruits! Ask me about:\n• **Fruit prices** – "how much is Dragon?"\n• **Best fruits** – "what\'s best for grinding/PvP?"\n• **Trading** – "what is Dough worth?"\n• **Progression** – "how do I get to second sea?"\n• **Awakening** – "how many fragments for Buddha?"\n\n*(For full AI responses, add an OPENAI_API_KEY secret to this Replit.)*';
}

function findFruitInMessage(message) {
  const fruits = require('../data/fruits.json');
  return fruits.find(f => message.includes(f.name.toLowerCase()));
}

module.exports = { askAI, clearHistory };
