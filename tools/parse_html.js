// 从官网英雄页 HTML 解析——只用可靠标记（class 名），不信 indexOf 文本
// 输出: 英雄资料/_官网数据/*.md
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "heroes_raw", "html");
const OUT = path.join(ROOT, "英雄资料", "_官网数据");
fs.mkdirSync(OUT, { recursive: true });

function txt(s) {
  return String(s || "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"')
    .replace(/\s+/g, " ").trim();
}

// 去掉 head（含 meta 污染）和 script
function bodyOnly(html) {
  return html
    .replace(/<head[\s\S]*?<\/head>/i, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
}

function parseSkills(body) {
  const skills = [];
  const re = /<p class="skill-name">\s*<b>([^<]+)<\/b>\s*(?:<span>([^<]*)<\/span>\s*)?(?:<span>([^<]*)<\/span>\s*)?<\/p>\s*<p class="skill-desc">([\s\S]*?)<\/p>/g;
  let m;
  while ((m = re.exec(body))) {
    skills.push({
      name: txt(m[1]),
      cd: (m[2] || "").replace(/^冷却值：?/, "").trim(),
      cost: (m[3] || "").replace(/^消耗：?/, "").trim(),
      desc: txt(m[4]),
    });
  }
  return skills;
}

// 铭文：真实数据在 <ul class="sugg-u1" data-ming="1504|3514|2517"> 的 **注释块**里
// 所以要在「去注释之前」的原始 HTML 上解析
function parseRunes(rawHtml) {
  // 注意：meta 里也有"铭文搭配建议"，所以必须找标题标记 </i>铭文搭配建议
  let i = rawHtml.indexOf("</i>铭文搭配建议");
  if (i < 0) i = rawHtml.indexOf("<h3 class=\"tlt fn\"><i class=\"tb3");
  if (i < 0) i = rawHtml.lastIndexOf("铭文搭配建议");
  if (i < 0) return { runes: [], ids: "", tip: "" };
  const seg = rawHtml.slice(i, i + 5000);
  // 1) 活动配置的 ID（可能有多个 ul，取第一个非注释/第一个）
  const idM = seg.match(/data-ming="([\d|]+)"/);
  const ids = idM ? idM[1] : "";
  // 2) 从该区段里抓全部 li：名字 + 属性
  const runes = [];
  const seen = new Set();
  for (const li of seg.split(/<li[^>]*>/).slice(1)) {
    const name = (li.match(/<em>([^<]+)<\/em>/) || [, ""])[1];
    if (!name) continue;
    const attrs = [...li.matchAll(/<p>([^<]+)<\/p>/g)]
      .map((x) => txt(x[1]))
      .filter((x) => x && x !== name.trim() && /[+\-]/.test(x));
    const key = name.trim();
    if (seen.has(key)) continue;
    seen.add(key);
    runes.push({ name: key, attrs: attrs.slice(0, 4) });
    if (runes.length >= 12) break;
  }
  // 3) 颜色分类（红/蓝/绿）按名字前两位粗判
  const ti = seg.indexOf("Tips：");
  const tip = ti >= 0 ? txt(seg.slice(ti + 5, ti + 400)).split("技能加点")[0] : "";
  return { runes, ids, tip };
}

// 加点：<p class="sugg-name"><b>主升</b></p> 后面跟 <img alt="技能1">
function parseAddPoint(body, skills) {
  const i = body.indexOf("技能加点建议");
  if (i < 0) return "";
  const seg = body.slice(i, i + 2500);
  const parts = [];
  for (const label of ["主升", "副升"]) {
    const re = new RegExp(`<b>${label}</b>[\\s\\S]{0,300}?alt="([^"]+)"`);
    const m = seg.match(re);
    if (!m) continue;
    let nm = txt(m[1]);   // 形如 "技能1"
    const num = (nm.match(/(\d+)/) || [])[1];
    if (num && skills[Number(num)]) nm = skills[Number(num)].name;
    else if (nm === "技能0" || /被动/.test(nm)) nm = skills[0] ? skills[0].name : nm;
    parts.push(`${label} ${nm}`);
  }
  return parts.join("　");
}

function parseSummoner(body) {
  const m = body.match(/<b>召唤师技能<\/b>\s*<span>([^<]*)<\/span>/);
  if (m) return txt(m[1]);
  const i = body.indexOf("召唤师技能");
  if (i < 0) return "";
  const seg = body.slice(i, i + 1200);
  const names = [...seg.matchAll(/alt="([^"]{2,10})"/g)].map((x) => txt(x[1]))
    .filter((x) => /闪现|终结|净化|疾跑|治疗|弱化|眩晕|狂暴|疾风/.test(x));
  return [...new Set(names)].slice(0, 4).join(" / ");
}

function parseItemTip(body) {
  const i = body.indexOf("equip-tips");
  if (i < 0) return "";
  const seg = body.slice(i, i + 800);
  const t = seg.match(/Tips：([\s\S]*?)<\/p>/);
  return t ? txt(t[1]) : txt(seg).split("Tips：")[1]?.slice(0, 200) || "";
}

const files = fs.readdirSync(SRC).filter((f) => f.endsWith(".html"));
const heroList = JSON.parse(fs.readFileSync(path.join(ROOT, "英雄资料", "_官网英雄列表.json"), "utf8"));
const nameBySlug = {};
heroList.forEach((h) => (nameBySlug[h.slug] = h.name));

let n = 0; const summary = [];
for (const f of files) {
  const slug = f.replace(/\.html$/, "");
  const name = nameBySlug[slug] || slug;
  const raw = fs.readFileSync(path.join(SRC, f), "utf8");
  const body = bodyOnly(raw);
  const skills = parseSkills(body);
  const { runes, ids, tip } = parseRunes(raw);   // 铭文要在原始 HTML（含注释）上解析
  const addPoint = parseAddPoint(body, skills);
  const summoner = parseSummoner(body);
  const itemTip = parseItemTip(body);
  const items = (body.match(/data-item="([^"]+)"/) || [, ""])[1];

  const L = [
    `# ${name}`,
    ``,
    `> **来源**：pvp.qq.com 英雄详情页（**官方**）｜slug \`${slug}\``,
    `> **抓取**：${new Date().toISOString().slice(0, 10)}｜技能 ${skills.length} 个`,
    `> ⚠️ 赛季更新后重抓：\`node tools/fetch_hero_html.js\` → \`node tools/parse_html.js\` → \`node tools/make_herodata.js\``,
    ``,
  ];
  if (skills.length) {
    L.push(`## 技能（官方原文）`, ``);
    skills.forEach((sk, i) => {
      L.push(`### ${i === 0 ? "被动" : "技能" + i}｜${sk.name}`);
      L.push(`- **冷却值**：${sk.cd || "—"}　**消耗**：${sk.cost || "—"}`);
      L.push(``, sk.desc, ``);
    });
  } else {
    L.push(`## ⚠️ 技能缺失`, ``);
  }
  if (runes.length) {
    L.push(`## 铭文（官网页面注释块内，ID \`${ids || "—"}\`）`, ``, `| 铭文 | 属性 |`, `|---|---|`);
    runes.forEach((r) => L.push(`| ${r.name} | ${(r.attrs || []).join(" / ")} |`));
    L.push(``);
    if (tip) L.push(`> **Tips**：${tip}`, ``);
  }
  if (addPoint) L.push(`## 加点（官方）`, ``, `${addPoint}`, ``);
  if (summoner) L.push(`## 召唤师技能（官方）`, ``, `${summoner}`, ``, `> ⚠️ 官方推荐≠实战最优（例：狂铁官网写"终结/净化"，实战只能带闪现）`, ``);
  if (itemTip) L.push(`## 出装 Tips（官方）`, ``, `> ${itemTip}`, ``);
  if (items) L.push(`**官网推荐出装（装备ID）**：\`${items}\``, ``);

  fs.writeFileSync(path.join(OUT, `${name}.md`), L.join("\n"), "utf8");
  n++;
  summary.push({ name, slug, 技能: skills.length, 铭文: runes.length, 加点: addPoint || "", 召唤师技能: summoner || "" });
}

console.log(`解析完成：${n} 个`);
console.log(`技能≥3：${summary.filter((s) => s.技能 >= 3).length}`);
console.log(`有铭文：${summary.filter((s) => s.铭文 > 0).length}`);
console.log(`有加点：${summary.filter((s) => s.加点).length}`);
console.log(`有召唤师技能：${summary.filter((s) => s.召唤师技能).length}`);
console.log(`\n样例：`);
["狂铁", "夏侯惇", "关羽", "六耳", "心魔六耳"].forEach((k) => {
  const s = summary.find((x) => x.name === k);
  if (s) console.log(`  ${s.name}: 技能${s.技能} 铭文${s.铭文} 加点「${s.加点}」 召唤师「${s.召唤师技能}」`);
});
fs.writeFileSync(path.join(OUT, "_概览.json"), JSON.stringify(summary, null, 1), "utf8");
