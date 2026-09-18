// 对局分析工具 · 本地服务
// 启动: node server.js   浏览器打开 http://127.0.0.1:<port>
const http = require("http");
const fs = require("fs");
const path = require("path");
const cfg = require("./config.js");
const cache = require("./matchup_cache.js");
const { buildCommonText } = require("./methodology.js");
const { buildProfileText } = require("./profile.js");

const ROOT = path.join(__dirname, "..");
const HERO_DIR = path.join(ROOT, "英雄资料");

// ---------- 数据 ----------
function loadJS(file, varName) {
  const p = path.join(HERO_DIR, file);
  if (!fs.existsSync(p)) return {};
  const t = fs.readFileSync(p, "utf8");
  return JSON.parse(t.replace(new RegExp("^window\\." + varName + " = "), "").replace(/;$/, ""));
}
let HERO = {}, TAGS = {}, MU = {};
function reloadData() {
  HERO = loadJS("herodata.js", "HERO_DATA");
  TAGS = loadJS("herotags.js", "HERO_TAGS");
  MU   = loadJS("matchups.js", "MATCHUPS");
}
reloadData();

// ---------- 提示词 ----------
function heroBrief(name) {
  const h = HERO[name], t = TAGS[name] || {};
  if (!h) return `### ${name}\n（数据库里没有这个英雄）`;
  const skills = (h.skills || []).map(s => `  ${s.slot}｜${s.name}（冷却 ${s.cd || "—"}）：${s.desc}`).join("\n");
  return `### ${name}
标签：定位=${t.role || "?"}　伤害=${t.dmg || "?"}　能否主动开团=${t.can || "?"}　机动=${t.mob || "?"}　坦度=${t.tank || "?"}　强势期=${t.spike || "?"}　线权=${t.line || "?"}
机制笔记：${t.note || "（无）"}
官方技能原文：
${skills}`;
}
function existing(a, b) {
  const my = MU[a];
  if (!my) return "（没有这个英雄的条目）";
  if (my.win && my.win[b]) return `已记录：${a} 打得过 ${b} —— ${my.win[b]}`;
  if (my.lose && my.lose[b]) return `已记录：${a} 打不过 ${b} —— ${my.lose[b]}`;
  if (my.even && my.even[b]) return `已记录：平线 —— ${my.even[b]}`;
  return "（没有这两个英雄的对位记录）";
}

const BASE_RULES = `
你是王者荣耀的高分教练。给下面这位玩家做对局指导。

${buildProfileText()}

${buildCommonText()}

# 硬性要求
1. **严格依据给出的官方技能原文**，不编造数值或机制。
2. **严格区分三件事**：线权（谁能推线）、换血（谁吃亏）、逃生/被抓风险（谁更容易被留住）。
3. **如果双方在机制上谁也留不住谁（都缺乏稳定留人手段），必须明确说"平线"**，不要硬分优劣。
4. 结论要**具体到操作**（几级做什么、该退还是该压、出什么过渡装）。
5. **不要给依赖队友配合的方案**（他的分段队友不会兑现），优先"能自己完成"的打法。
6. **绝对不要预测"某方能击杀某方"这类结果**——这取决于操作、装备、等级、打野位置，技能原文里没有依据。只描述机制层面的事实。
7. **区分"事实"和"推测"**：技能原文里写了的 = 事实；你的推断 = 必须标注"（推测）"。
8. 不确定就说不确定，不要瞎猜。
`;

const SYS_MATCH = BASE_RULES + `
输出格式（严格遵守，不要额外段落）：
【判定】平线 / 我占优 / 我劣势
【线权】谁能推线、谁被迫补塔刀
【换血】谁换血吃亏
【逃生】谁更容易被抓死、谁更容易留住对方
【对线怎么打】2-4条
【关键时间点】一句话`;

const SYS_COMP = BASE_RULES + `
半图定义提醒：**发育路半图 = 中路+打野+发育路+游走**；**对抗路半图 = 中路+打野+对抗路**。

输出格式（严格遵守）：
【强势半图】哪一片，为什么
【中轴线权】谁先动
【突破口】敌方最薄弱的位置
【这局怎么赢】3-4条（必须是自己能独立完成的）
【我的对位】如果有指定英雄，给对线要点`;

async function callAI(system, user, maxTokens) {
  const { key, from } = cfg.getKey();
  if (!key) return { error: "NO_KEY", needSetup: true };
  const c = cfg.load();
  try {
    const r = await fetch(`${c.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: c.model,
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
        temperature: 0.3, max_tokens: maxTokens || 1200,
      }),
    });
    const j = await r.json();
    if (j.error) return { error: JSON.stringify(j.error), keyFrom: from };
    return { text: j.choices[0].message.content, usage: j.usage, keyFrom: from };
  } catch (e) {
    return { error: "网络请求失败：" + e.message };
  }
}

// ---------- HTTP ----------
const MIME = { ".html":"text/html; charset=utf-8", ".js":"application/javascript; charset=utf-8",
               ".css":"text/css; charset=utf-8", ".json":"application/json; charset=utf-8",
               ".png":"image/png", ".jpg":"image/jpeg", ".md":"text/markdown; charset=utf-8" };

function json(res, obj, code) {
  res.writeHead(code || 200, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(obj));
}
function readBody(req, cb) {
  let b = ""; req.on("data", c => b += c);
  req.on("end", () => { try { cb(JSON.parse(b)); } catch (e) { cb(null); } });
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x");
  const P = u.pathname;

  // ===== 状态 =====
  if (P === "/api/status") {
    const { key, from } = cfg.getKey();
    return json(res, {
      hasKey: !!key, keyFrom: from, model: cfg.load().model,
      heroes: Object.keys(HERO).length, tags: Object.keys(TAGS).length,
      matchupRecords: Object.keys(MU).length, cacheStats: cache.stats(),
    });
  }
  // ===== 配置 =====
  if (P === "/api/config" && req.method === "GET") {
    const c = cfg.load();
    return json(res, { ...c, apiKey: c.apiKey ? "***已设置***" : "" });
  }
  if (P === "/api/config" && req.method === "POST") {
    return readBody(req, (b) => {
      if (!b) return json(res, { error: "请求体无效" }, 400);
      const patch = {};
      if (typeof b.apiKey === "string") patch.apiKey = b.apiKey.trim();
      if (typeof b.baseUrl === "string" && b.baseUrl.trim()) patch.baseUrl = b.baseUrl.trim().replace(/\/+$/, "");
      if (typeof b.model === "string" && b.model.trim()) patch.model = b.model.trim();
      if (b.allowDSHKey !== undefined) patch.allowDSHKey = !!b.allowDSHKey;
      cfg.save(patch);
      const { key, from } = cfg.getKey();
      json(res, { ok: true, hasKey: !!key, keyFrom: from });
    });
  }
  if (P === "/api/testkey") {
    const out = await callAI("只回答两个字：正常", "测试", 20);
    return json(res, out.error ? { ok: false, error: out.error } : { ok: true, reply: out.text });
  }

  // ===== 对位分析 =====
  if (P === "/api/matchup") {
    const a = u.searchParams.get("a"), b = u.searchParams.get("b"), lane = u.searchParams.get("lane") || "";
    if (!a || !b) return json(res, { error: "缺参数" }, 400);
    const cached = cache.get(a, b, lane);
    // cacheonly=1：只查缓存，不调 AI（前端直连模式下用这个）
    if (u.searchParams.get("cacheonly")) {
      if (cached) return json(res, { text: cached.text, cached: true, source: cached.source,
                                     createdAt: cached.createdAt, verified: cached.verified });
      return json(res, { text: "", cached: false });
    }
    if (cached && !u.searchParams.get("force")) {
      return json(res, { text: cached.text, cached: true, source: cached.source,
                         createdAt: cached.createdAt, verified: cached.verified });
    }
    const prompt = `分路：${lane || "（未指定）"}
对位：**${a}（我） vs ${b}（对面）**

${heroBrief(a)}

${heroBrief(b)}

${existing(a, b)}

按格式分析。`;
    const out = await callAI(SYS_MATCH, prompt, 1200);
    if (out.error === "NO_KEY") return json(res, { error: "没配置 API Key", needSetup: true });
    if (out.error) return json(res, { error: out.error });
    cache.put(a, b, lane, out.text, out.usage && out.usage.total_tokens);
    return json(res, { ...out, cached: false, source: "ai" });
  }

  // ===== 分享结果到公共库（前端直连模式下，浏览器把新结果发过来）=====
  // 只接收分析文本，**不接收任何 Key**
  if (P === "/api/share") {
    return readBody(req, (b) => {
      if (!b || !b.a || !b.b || !b.text) return json(res, { error: "缺参数" }, 400);
      const old = cache.get(b.a, b.b, b.lane || "");
      if (old && old.source === "user") return json(res, { ok: true, skipped: "已有用户验证版本" });
      cache.put(b.a, b.b, b.lane || "", b.text, b.tokens || 0);
      json(res, { ok: true });
    });
  }

  // ===== 阵容方向 =====
  if (P === "/api/comp") {
    return readBody(req, async (comp) => {
      if (!comp) return json(res, { error: "请求体无效" }, 400);
      const fmt = (l) => l.map(x => `${x.lane}=${x.name}`).join("　");
      const prompt = `敌方阵容：${fmt(comp.enemy)}
我方阵容：${fmt(comp.ally)}
我玩：${comp.me || "（未指定）"}

${comp.enemy.map(x => heroBrief(x.name)).join("\n\n")}

${comp.ally.map(x => heroBrief(x.name)).join("\n\n")}

按格式分析这局。`;
      const out = await callAI(SYS_COMP, prompt, 1500);
      if (out.error === "NO_KEY") return json(res, { error: "没配置 API Key", needSetup: true });
      if (out.error) return json(res, { error: out.error });
      json(res, out);
    });
    return;
  }

  // ===== 用户修正 =====
  if (P === "/api/correct") {
    return readBody(req, (b) => {
      if (!b) return json(res, { error: "请求体无效" }, 400);
      const rec = cache.correct(b.a, b.b, b.lane, b.text);
      json(res, { ok: true, rec });
    });
  }
  if (P === "/api/cache") return json(res, { stats: cache.stats(), all: cache.load() });
  if (P === "/api/reload") { reloadData(); return json(res, { ok: true }); }

  // ===== 静态 =====
  let p = P === "/" ? "/对局分析工具.html" : decodeURIComponent(P);
  const fp = path.join(HERO_DIR, p);
  if (!fp.startsWith(HERO_DIR)) { res.writeHead(403); return res.end("forbidden"); }
  if (!fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); return res.end("not found"); }
  res.writeHead(200, { "Content-Type": MIME[path.extname(fp).toLowerCase()] || "application/octet-stream" });
  fs.createReadStream(fp).pipe(res);
});

const PORT = cfg.load().port || 8777;
server.listen(PORT, "127.0.0.1", () => {
  const { key, from } = cfg.getKey();
  console.log(`✅ 服务已启动： http://127.0.0.1:${PORT}`);
  console.log(`   英雄 ${Object.keys(HERO).length}　标签 ${Object.keys(TAGS).length}　对位记录 ${Object.keys(MU).length} 个英雄`);
  console.log(`   API Key：${key ? "已配置（来源：" + from + "）" : "❌ 未配置 → AI 不可用，但本地规则引擎仍可用"}`);
  console.log(`   配置文件：${cfg.CFG}`);
});
