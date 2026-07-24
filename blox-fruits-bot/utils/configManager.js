const fs   = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data', 'guilds');

const DEFAULTS = {
  rollCooldownHours: 2,
  stockChannelId:    null,
  aiChannels:        {},
};

function configPath(guildId) {
  return path.join(DATA_DIR, guildId, 'config.json');
}

function getConfig(guildId) {
  const p = configPath(guildId);
  if (!fs.existsSync(p)) return { ...DEFAULTS, aiChannels: {} };
  try {
    const loaded = JSON.parse(fs.readFileSync(p, 'utf-8'));
    return { ...DEFAULTS, aiChannels: {}, ...loaded };
  } catch { return { ...DEFAULTS, aiChannels: {} }; }
}

function saveConfig(guildId, cfg) {
  const p = configPath(guildId);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(cfg, null, 2));
}

function setRollCooldown(guildId, hours) {
  const cfg = getConfig(guildId);
  cfg.rollCooldownHours = hours;
  saveConfig(guildId, cfg);
}

function setStockChannel(guildId, channelId) {
  const cfg = getConfig(guildId);
  cfg.stockChannelId = channelId;
  saveConfig(guildId, cfg);
}

function getRollCooldownMs(guildId) {
  const cfg = getConfig(guildId);
  return (cfg.rollCooldownHours || 2) * 60 * 60 * 1000;
}

function registerAiChannel(guildId, channelId, userId) {
  const cfg = getConfig(guildId);
  if (!cfg.aiChannels) cfg.aiChannels = {};
  cfg.aiChannels[channelId] = userId;
  saveConfig(guildId, cfg);
}

function unregisterAiChannel(guildId, channelId) {
  const cfg = getConfig(guildId);
  if (cfg.aiChannels) delete cfg.aiChannels[channelId];
  saveConfig(guildId, cfg);
}

function getAiChannelUser(guildId, channelId) {
  const cfg = getConfig(guildId);
  return cfg.aiChannels?.[channelId] ?? null;
}

function isAiChannel(guildId, channelId) {
  return getAiChannelUser(guildId, channelId) !== null;
}

function findUserAiChannel(guildId, userId) {
  const cfg = getConfig(guildId);
  if (!cfg.aiChannels) return null;
  for (const [chId, uId] of Object.entries(cfg.aiChannels)) {
    if (uId === userId) return chId;
  }
  return null;
}

module.exports = {
  getConfig, saveConfig,
  setRollCooldown, setStockChannel, getRollCooldownMs,
  registerAiChannel, unregisterAiChannel,
  getAiChannelUser, isAiChannel, findUserAiChannel,
};
