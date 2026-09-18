// 把 _官网数据/*.md 转成工具用的 JS 数据文件
const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..", "英雄资料", "_官网数据");
const OUT = path.join(__dirname, "..", "英雄资料", "herodata.js");

const heroes = {};
for (const f of fs.readdirSync(SRC).filter((x) => x.endsWith(".md") && !x.startsWith("_"))) {
  const name = f.replace(/\.md$/, "");
  const t = fs.readFileSync(path.join(SRC, f), "utf8");
  const skills = [];
  // 只在「## 技能（官方原文）」区段里解析，避免抓到页脚
  const si = t.indexOf("## 技能（官方原文）");
  const zone = si >= 0 ? t.slice(si) : t;
  const re = /### (被动|技能\d)｜([^\n]+)\n- \*\*冷却值\*\*：([^\s　]*)[^\n]*\n\n([\s\S]*?)(?=\n### |\n## |\n\*\*|$)/g;
  let m;
  while ((m = re.exec(zone))) {
    skills.push({ slot: m[1], name: m[2].trim(), cd: m[3].trim(), desc: m[4].trim() });
  }
  // 铭文
  const runes = [];
  const ri = t.indexOf("## 铭文（官方推荐）");
  if (ri >= 0) {
    const nxt = t.indexOf("##", ri + 5);
    const seg = t.slice(ri, nxt > 0 ? nxt : ri + 1500);
    for (const r of seg.matchAll(/^\| ([\u4e00-\u9fa5]{2,6}) \| ([^|]+) \|$/gm)) {
      runes.push({ name: r[1], attrs: r[2].trim() });
    }
  }
  // 加点：只取第一行，且截断到合理长度
  let ap = (t.match(/## 加点（官方）\n\n([^\n]+)/) || [, ""])[1].trim();
  if (ap.length > 30) ap = ap.slice(0, 30);
  let sm = (t.match(/## 召唤师技能（官方）\n\n([^\n]+)/) || [, ""])[1].trim();
  if (sm.length > 20) sm = sm.slice(0, 20);
  heroes[name] = { name, skills, runes, addPoint: ap, summoner: sm };
}

fs.writeFileSync(OUT, "window.HERO_DATA = " + JSON.stringify(heroes) + ";", "utf8");
const n = Object.keys(heroes).length;
const withSkills = Object.values(heroes).filter((h) => h.skills.length >= 3).length;
console.log(`已生成：${n} 个英雄（技能≥3 的 ${withSkills} 个）`);
console.log(`文件：${OUT}  ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB`);
