// 把 AI 的对位分析存下来，下次直接调用
// 服务端在 /api/matchup 时：先查缓存 → 有就直接返回 → 没有再调 AI 并写入
const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "..", "英雄资料", "matchups_ai.json");

function load() {
  try { return JSON.parse(fs.readFileSync(FILE, "utf8")); } catch { return {}; }
}
function save(db) {
  fs.writeFileSync(FILE, JSON.stringify(db, null, 1), "utf8");
}
function key(a, b, lane) { return `${lane}|${a}|${b}`; }

// 查缓存
function get(a, b, lane) {
  const db = load();
  return db[key(a, b, lane)] || null;
}

// 写入（AI 生成的）
function put(a, b, lane, text, tokens) {
  const db = load();
  const k = key(a, b, lane);
  db[k] = {
    a, b, lane,
    text,
    tokens: tokens || 0,
    source: "ai",
    createdAt: new Date().toISOString().slice(0, 16).replace("T", " "),
    verified: false,     // 用户还没确认过
  };
  save(db);
  return db[k];
}

// 用户修正（覆盖 AI 结论，标记为已验证）
function correct(a, b, lane, text) {
  const db = load();
  const k = key(a, b, lane);
  db[k] = {
    ...(db[k] || { a, b, lane }),
    text,
    source: "user",
    correctedAt: new Date().toISOString().slice(0, 16).replace("T", " "),
    verified: true,
  };
  save(db);
  return db[k];
}

// 统计
function stats() {
  const db = load();
  const all = Object.values(db);
  return {
    total: all.length,
    ai: all.filter(x => x.source === "ai").length,
    user: all.filter(x => x.source === "user").length,
  };
}

module.exports = { load, get, put, correct, stats, FILE };
