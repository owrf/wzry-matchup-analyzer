// 线权数据库 —— 只收录有明确依据的，不收录推测
//
// ⚠️ 收录标准（严格）：
//   1. 必须有来源（文档/实战复盘/官方机制）
//   2. T 度排行 ≠ 线权，不能从梯度榜推断线权
//   3. 没有依据的宁可不写，也不填推测值
//
// 分档定义（只描述"能不能抢线"，不涉及强弱）：
//   S = 清线极快，基本必然先动（对手很难抢）
//   A = 清线快，多数情况能先动
//   B = 清线中等，看对手
//   C = 清线慢，基本只能补塔刀
//
// 输出: 英雄资料/lanepower.js
const fs = require("fs");
const path = require("path");

const HERO = {};       // 英雄 → { tier, why, source }
const PAIR = {};       // 对位 → { 结果, why, source }

// ==================== 单英雄线权（有依据的才写）====================

// ---- 中路 ----
HERO["沈梦溪"] = { tier:"S", why:"炮台法师 + 跑图极快 + 全屏大招，清线速度顶级",
  source:"五局KPL教练级复盘（第一局：敌方沈梦溪有线权，我方甄姬被迫反向换节奏）" };
HERO["甄姬"] = { tier:"C", why:"清线慢。**T2 档位不等于线权**——她挂边当工具人有用，但对线拿不到中线权，只能补塔刀",
  source:"五局KPL教练级复盘（第一局：「1级抢中线，我方输定了」「甄姬拿不到中线权，就只能换节奏」）" };

// ==================== 对位线权（有依据的才写）====================
PAIR["沈梦溪|甄姬"] = { r:"沈梦溪线权压倒性优势",
  why:"我方（甄姬）1 级抢中线输定，中路被压制；沈梦溪拿到线权后先动帮边路、控资源",
  source:"五局KPL教练级复盘（第一局）" };

// ==================== 待补充（有疑问但没依据的）====================
const PENDING = [
  { q:"小乔 vs 甄姬 的线权对比", status:"❌ 无依据",
    note:"用户指出「甄姬清线很慢，线权远小于小乔」。但两份复盘文档里「小乔」出现 0 次，无法论证。" },
  { q:"中路各英雄的线权排序", status:"❌ 缺资料",
    note:"需要可靠来源（KPL 复盘 / 高分段实战 / 实测）。T 度榜不能用来推线权。" },
  { q:"对抗路各英雄线权排序", status:"⚠️ 部分有依据",
    note:"芈月线权高（她克制链资料+实战），蒙恬线权高。其余待补。" },
];

// ==================== 输出 ====================
const out = `// ⚠️ 本文件由 tools/make_lanepower.js 生成，不要手改
// 线权数据：只收录有依据的条目。T度 ≠ 线权。
window.LANE_POWER = ${JSON.stringify({ hero: HERO, pair: PAIR, pending: PENDING }, null, 1)};
`;
fs.writeFileSync(path.join(__dirname, "..", "英雄资料", "lanepower.js"), out, "utf8");

// 统计
console.log(`线权数据库（有依据的）`);
console.log(`  单英雄：${Object.keys(HERO).length} 个`);
console.log(`  对位：${Object.keys(PAIR).length} 条`);
console.log(`\n【单英雄】`);
Object.entries(HERO).forEach(([k, v]) => console.log(`  ${v.tier}  ${k}　— ${v.why.slice(0, 50)}`));
console.log(`\n【对位】`);
Object.entries(PAIR).forEach(([k, v]) => console.log(`  ${k.replace("|", " vs ")}　${v.r}`));
console.log(`\n【待补充（没依据的）】`);
PENDING.forEach(p => console.log(`  ${p.status}  ${p.q}`));
