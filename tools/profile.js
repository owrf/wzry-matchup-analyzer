// 个人档案（默认模板）
//
// ⚠️ 这里只是**默认示例**。用户在前端「⚙️ 设置 → 我的档案」里填写，
//    存在浏览器 localStorage，会覆盖这里的默认值。
//    改这里只是改"新用户的默认值"。
//
// 开源仓库里请保留通用示例，不要填真实个人信息。

const PROFILE = {
  rank: "",          // 例："巅峰赛 1600 分"（留空 = 不告诉 AI 分段）
  role: "",          // 例："对抗路"
  heroes: [],        // 例：["狂铁", "李信"]
  avoid: [],         // 例：["发育路"]
  traits: [],        // 例：["基本功扎实，但当前分段队友不会兑现机会"]
};

// 服务端组装（本地版用）；前端用的是 promptdata.js 里的版本
function buildProfileText(P) {
  const p = P || PROFILE;
  const parts = [];
  const has = (p.rank || p.role || (p.heroes||[]).length || (p.avoid||[]).length || (p.traits||[]).length);
  if (!has) return "";   // 什么都没填就不加这段
  parts.push("# 服务对象的情况");
  if (p.rank)   parts.push("- 分段：**" + p.rank + "**");
  if (p.role)   parts.push("- 主玩位置：**" + p.role + "**");
  if (p.heroes && p.heroes.length) parts.push("- 英雄池（主力在前）：**" + p.heroes.join("、") + "**");
  if (p.avoid && p.avoid.length)   parts.push("- 不玩的位置：" + p.avoid.join("、") + "（不要给这些位置的建议）");
  if (p.traits && p.traits.length) {
    parts.push("- 打法特点：");
    p.traits.forEach(t => parts.push("  - " + t));
  }
  return parts.join("\n");
}

module.exports = { PROFILE, buildProfileText };
