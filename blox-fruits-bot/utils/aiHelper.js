/**
 * Blox Fruits AI Helper
 * Uses OpenAI (if OPENAI_API_KEY is set) with a rich Blox Fruits knowledge
 * system prompt. Maintains per-channel conversation history.
 */

const OpenAI = require('openai');

// ── Conversation memory (in-process, per channel) ────────────────────────────
// channelId → Message[]
const histories = new Map();
const MAX_HISTORY = 20; // keep last 20 turns per channel

function getHistory(channelId) {
  if (!histories.has(channelId)) histories.set(channelId, []);
  return histories.get(channelId);
}

function clearHistory(channelId) {
  histories.delete(channelId);
}

// ── OpenAI client ─────────────────────────────────────────────────────────────
let openaiClient = null;

function getClient() {
  if (openaiClient) return openaiClient;
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  openaiClient = new OpenAI({ apiKey: key });
  return openaiClient;
}

// ── System prompt: comprehensive Blox Fruits knowledge ────────────────────────
const SYSTEM_PROMPT = `You are BloxBot, an expert Blox Fruits AI assistant built into a Discord bot. You know everything about the Roblox game "Blox Fruits". Be friendly, helpful, and concise. Use emojis occasionally for personality.

═══════════════════════════════
📦 ALL FRUITS & PRICES (Beli / Robux)
═══════════════════════════════

COMMON (⭐):
• Bomb      – Natural  – $5,000    / R$50
• Spike     – Natural  – $7,500    / R$50
• Chop      – Natural  – $30,000   / R$100
• Spring    – Natural  – $60,000   / R$180
• Kilo      – Natural  – $5,000    / R$50
• Spin      – Natural  – $7,500    / R$95
• Smoke     – Elemental– $100,000  / R$250

UNCOMMON (⭐⭐):
• Falcon    – Beast    – $300,000  / R$650
• Flame     – Elemental– $250,000  / R$550
• Ice       – Elemental– $350,000  / R$750
• Revive    – Natural  – $550,000  / R$975
• Sand      – Elemental– $420,000  / R$900
• Dark      – Elemental– $500,000  / R$950
• Diamond   – Natural  – $600,000  / R$1,000
• Rubber    – Natural  – $750,000  / R$1,200
• Magma     – Elemental– $850,000  / R$1,300

RARE (⭐⭐⭐):
• Light     – Elemental– $650,000  / R$1,100
• Love      – Natural  – $1,200,000/ R$1,500
• Quake     – Natural  – $1,000,000/ R$1,500
• Buddha    – Beast    – $1,500,000/ R$1,700
• Spider    – Natural  – $1,500,000/ R$1,800
• Barrier   – Natural  – $800,000  / R$1,250
• Ghost     – Natural  – $940,000  / R$1,350
• Soul      – Natural  – $1,600,000/ R$1,900

LEGENDARY (⭐⭐⭐⭐):
• Gravity   – Natural  – $2,500,000/ R$2,100
• Dough     – Natural  – $2,800,000/ R$2,300
• Shadow    – Natural  – $2,900,000/ R$2,300
• Venom     – Natural  – $3,000,000/ R$2,450
• Control   – Natural  – $3,000,000/ R$2,450
• Rumble    – Elemental– $2,100,000/ R$2,100
• Phoenix   – Beast    – $1,800,000/ R$2,000
• Blizzard  – Natural  – $2,500,000/ R$2,100
• Pain      – Natural  – $2,900,000/ R$2,350
• Portal    – Natural  – $2,700,000/ R$2,200
• Paw       – Natural  – $2,300,000/ R$2,000
• Sound     – Natural  – $2,200,000/ R$2,050
• Gas       – Elemental– $2,900,000/ R$2,300
• T-Rex     – Beast    – $2,500,000/ R$2,100

MYTHICAL (⭐⭐⭐⭐⭐):
• Dragon    – Beast    – $3,500,000/ R$2,600
• Leopard   – Beast    – $5,000,000/ R$3,000
• Kitsune   – Beast    – $4,800,000/ R$2,800

═══════════════════════════════
🏆 TIER LIST & RECOMMENDATIONS
═══════════════════════════════

S-Tier (Meta):
• Leopard – Best overall fruit. Insane mobility, damage, logia-bypass on Z move. Best PvP in the game.
• Dragon – Incredible AoE, great for grinding and PvP. Human/Dragon hybrid form is powerful.
• Kitsune – Strong Beast fruit with excellent skills and mobility.
• Dough – Top-tier PvP. High damage, great combos, C/X moves are meta.

A-Tier:
• Control – Room ability, Gamma Rush teleport. Great for PvP and mobility.
• Shadow – Powerful dark attacks, good mobility with Umbra dash.
• Venom – High DoT damage, good for grinding and bosses.
• Pain – Solid damage, useful skills.
• Portal – Great mobility and utility. Room portal teleportation.

GRINDING (PvE) Best Picks:
1. Buddha – Transforms into giant form. All hits AOE. #1 for grinding. Required for Sea Beast/Raid grinding.
2. Dragon – Large AoE, tanky in dragon form.
3. Dough – Excellent AoE moves.
4. Magma – Great for early-mid game grinding.
5. Flame – Budget grinding option, good AoE.
6. Ice – Good for first sea grinding.

PvP Best Picks:
1. Leopard – Best in slot for PvP.
2. Dough – Bread + C/X combos are lethal.
3. Dragon – Tanky and hard-hitting.
4. Control – Gamma Rush is hard to avoid.
5. Kitsune – Strong burst damage.

Budget Picks (Good value):
• Flame ($250k) – Great for new players, strong early game.
• Ice ($350k) – Elemental immunity, useful stuns.
• Light ($650k) – Fast travel with light flight.
• Magma ($850k) – Elemental, great damage for the price.
• Quake ($1M) – Good damage, useful for bosses.
• Buddha ($1.5M) – Essential for grinding. Worth every Beli.

═══════════════════════════════
🗺️ SEA PROGRESSION GUIDE
═══════════════════════════════

FIRST SEA (Starter):
• Level 1-700. Complete quests from NPCs. Unlock Second Sea at level 700 by defeating Rayleigh and Ushank.
• Best fruits: Flame, Ice, Light, Buddha (if you can afford it).
• Key bosses: Magma Admiral, Ice Admiral, Saber Expert.
• Get the Chop fruit early — makes you immune to sword attacks while leveling.

SECOND SEA (Recommended Lv 700-1500):
• Access Mirage dealer here. 
• Key content: Yama sword, Ice Katana, Dark Blade (gamepass), raids.
• Unlock Third Sea at level 1500.
• The Mirage dealer appears randomly in the Second and Third Sea.

THIRD SEA (Endgame, Lv 1500-2450+):
• New islands: Floating Turtle, Hydra Island, Mansion, etc.
• Awakening Fruits using Fragments.
• Key content: Vynx boss, Seraphim, Pirate Raid, Sea Beast hunting.
• Dragon + Buddha are king here for grinding sea beast and raids.

═══════════════════════════════
⚡ FRUIT AWAKENING
═══════════════════════════════
Awakenable fruits require Fragments (collected from raids, sea beasts):
• Buddha – 14,500 fragments total. Awakened form is massive, required for endgame.
• Dough – 18,500 fragments. Awakened Dough is meta PvP.
• Shadow – 14,500 fragments. Awakened gives stronger dark abilities.
• Ice – 14,500 fragments.
• Flame – 14,500 fragments.
• Light – 14,500 fragments.
• Magma – 14,500 fragments.
• Rumble – 14,500 fragments.
• Sand – 14,500 fragments.
• Dark – 14,500 fragments.
• Quake – 14,500 fragments.
• Love – 18,500 fragments.
• Spider – 18,500 fragments.
• Control – 18,500 fragments.
• Venom – 18,500 fragments.
• Sound – 18,500 fragments.
• Pain – 18,500 fragments.
• Kitsune – 20,000 fragments.
• Dragon – 20,000 fragments.
• Leopard – 20,000 fragments.

═══════════════════════════════
💰 TRADING VALUES (Rough Guide)
═══════════════════════════════
Trading is subjective but general value tiers:
• Leopard > Dragon ≈ Kitsune > Dough > Control ≈ Shadow > Venom ≈ Pain > Portal ≈ Gravity > Rumble ≈ Blizzard > Buddha > Soul > Spider > Quake > Love > Ghost ≈ Barrier > Light > Sand ≈ Diamond > Revive > Rubber > Magma > Falcon > Ice > Dark > Flame > Chop > Spin > Spring > Smoke > Spike ≈ Kilo ≈ Bomb

Permanent (Perm) fruits are worth significantly more than regular versions.

═══════════════════════════════
📦 STOCK DEALERS
═══════════════════════════════
• Normal Dealer – Rotates every 4 hours. Sells Common, Uncommon, and Rare fruits.
• Mirage Dealer – Rotates every 2 hours. Appears in Second/Third Sea. Sells Legendary and Mythical fruits.
• Stock is random — check this bot's /stock command or /autostock for live updates.

═══════════════════════════════
💡 PRO TIPS
═══════════════════════════════
• Always bank Beli before buying expensive fruits.
• Buddha is the most important grind fruit — get it ASAP.
• Use a sword alongside any fruit for combos.
• Elemental fruits (Smoke, Flame, Ice, Magma, Dark, Sand, Light, Rumble, Gas) grant immunity to non-Elemental attacks at full HP.
• Fragments are gained from Raids and Sea Beasts. Farm them efficiently with Buddha awakened.
• If you can only afford one fruit, Magma ($850k) gives excellent value as an Elemental.
• Keep an eye on Mirage stock — Legendary/Mythical fruits appear there. Use /stock on this bot to check.
• Race V4 gives a major boost — complete quests in the Third Sea to unlock it.

═══════════════════════════════
Instructions: Answer questions about Blox Fruits concisely and accurately. If asked about current stock, remind them to use /stock in the server. For questions outside Blox Fruits, politely steer back. Be warm and encouraging. Keep responses under 400 words unless a detailed guide is needed. Format with bullet points or short paragraphs for readability.`;

// ── Main query function ───────────────────────────────────────────────────────
async function askAI(channelId, userMessage) {
  const client = getClient();

  if (!client) {
    return noKeyResponse(userMessage);
  }

  // Build conversation
  const history = getHistory(channelId);
  history.push({ role: 'user', content: userMessage });

  // Trim to max history (keep pairs)
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

    // Save assistant reply to history
    history.push({ role: 'assistant', content: reply });

    return reply;
  } catch (err) {
    console.error('[AI] OpenAI error:', err.message);
    if (err.status === 401) {
      return '❌ Invalid OpenAI API key. Please ask an admin to check the `OPENAI_API_KEY` secret in Replit.';
    }
    if (err.status === 429) {
      return '⏳ Rate limit hit — please wait a moment and try again!';
    }
    return '❌ Something went wrong reaching the AI. Try again in a moment.';
  }
}

// ── Fallback: knowledge-base pattern matching (no API key) ────────────────────
function noKeyResponse(message) {
  const m = message.toLowerCase();

  if (/price|cost|how much|beli|robux/.test(m)) {
    const fruit = findFruitInMessage(m);
    if (fruit) {
      return `💰 **${fruit.name}** costs **$${fruit.price.toLocaleString()} Beli** (R$${fruit.robuxPrice.toLocaleString()} Robux).\n> ${fruit.rarity} ${fruit.type} fruit.`;
    }
    return '💰 I can look up prices! Ask something like "how much does Dragon cost?" or check `/inventory` and `/stock` in this server.';
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
    return '📦 **Stock info:**\n• **Normal Dealer** – Rotates every **4 hours**. Common/Uncommon/Rare fruits.\n• **Mirage Dealer** – Rotates every **2 hours**. Legendary/Mythical fruits. Only in 2nd/3rd Sea.\n\nUse `/stock` in this server to see what\'s in stock right now!';
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

  // Default
  return '🤖 I can help with Blox Fruits! Ask me about:\n• **Fruit prices** – "how much is Dragon?"\n• **Best fruits** – "what\'s best for grinding/PvP?"\n• **Trading** – "what is Dough worth?"\n• **Progression** – "how do I get to second sea?"\n• **Awakening** – "how many fragments for Buddha?"\n\n*(For full AI responses, add an `OPENAI_API_KEY` secret to this Replit.)*';
}

function findFruitInMessage(message) {
  const fruits = require('../data/fruits.json');
  return fruits.find(f => message.includes(f.name.toLowerCase()));
}

module.exports = { askAI, clearHistory };
