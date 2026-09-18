// 配置管理
// Key 读取优先级：环境变量 > config.json
// ⚠️ Key 只用于"服务器代为调用 AI"的可选模式；默认推荐用浏览器直连（Key 不上传）
const fs = require("fs");
const path = require("path");

const CFG = path.join(__dirname, "..", "config.json");

const DEFAULTS = {
  apiKey: "",                                   // 留空则 AI 由浏览器直连（推荐）
  baseUrl: "https://api.deepseek.com",
  model: "deepseek-chat",
  port: 8777,
};

function load() {
  let c = { ...DEFAULTS };
  if (fs.existsSync(CFG)) {
    try { Object.assign(c, JSON.parse(fs.readFileSync(CFG, "utf8"))); } catch { }
  }
  return c;
}
function save(patch) {
  const c = { ...load(), ...patch };
  fs.writeFileSync(CFG, JSON.stringify(c, null, 2), "utf8");
  return c;
}
function getKey() {
  const c = load();
  if (process.env.DEEPSEEK_API_KEY) return { key: process.env.DEEPSEEK_API_KEY, from: "环境变量" };
  if (c.apiKey) return { key: c.apiKey, from: "config.json" };
  return { key: "", from: "" };
}

module.exports = { load, save, getKey, CFG, DEFAULTS };