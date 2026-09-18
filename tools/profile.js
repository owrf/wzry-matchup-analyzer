// 个人档案 —— 每个用户可以改成自己的情况
//
// ⚠️ 这是唯一应该填个人信息的文件
// 如果 fork 了本项目，请把下面改成你自己的情况
// 开源仓库里保留的是"示例"，不是真实用户资料

const PROFILE = {
  // 你的分段（影响 AI 给的建议）
  rank: "巅峰赛 1600 分",

  // 你的位置
  role: "对抗路",

  // 你的英雄池：主力在前
  heroes: ["狂铁", "李信"],

  // 你不玩的位置（AI 不会给你这些位置的建议）
  avoid: ["发育路"],

  // 你的打法特点（AI 会据此调整建议）
  traits: [
    "基本功扎实，意识超过当前分段",
    "习惯「我创造机会、队友兑现」的高分打法，但当前分段队友不会兑现",
  ],

  // 分段修正：高分段经验在低分段会失效的地方
  rankNotes: [
    "**压线后不要盲目转线**——低分队友不会接你的节奏，你转过去他可能在打野怪。改成：**压完线直接吃下一个资源**（对面野区/河道之灵/下一波线）",
    "**不要用高分段的读人模型读低分玩家**——低分玩家是「没逻辑」，不是「有套路」。那个射手敢摸塔，可能只是单纯没意识，不是有反蹲",
    "**不要指望队友兑现你创造的机会**——你开团，队友可能还在打野。优先选能自己创造、自己兑现的英雄",
  ],
};

// 组装成给 AI 的文本
function buildProfileText() {
  const P = PROFILE;
  const parts = [];
  parts.push(`# 服务对象的情况`);
  if (P.rank) parts.push(`- 分段：**${P.rank}**`);
  if (P.role) parts.push(`- 主玩位置：**${P.role}**`);
  if (P.heroes && P.heroes.length) parts.push(`- 英雄池（主力在前）：**${P.heroes.join("、")}**`);
  if (P.avoid && P.avoid.length) parts.push(`- 不玩的位置：${P.avoid.join("、")}（不要给这些位置的建议）`);
  if (P.traits && P.traits.length) {
    parts.push(`- 打法特点：`);
    P.traits.forEach(t => parts.push(`  - ${t}`));
  }
  if (P.rankNotes && P.rankNotes.length) {
    parts.push(`\n## 分段修正（高分段经验在这里会失效，必须遵守）`);
    P.rankNotes.forEach((t, i) => parts.push(`${i + 1}. ${t}`));
  }
  parts.push(`\n**核心要求**：你给的打法必须是**能自己独立完成**的（推塔、带线牵制、远程消耗），不要依赖队友配合。`);
  return parts.join("\n");
}

module.exports = { PROFILE, buildProfileText };
