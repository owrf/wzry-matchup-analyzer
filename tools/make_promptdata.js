// 把 Node 端的提示词材料打包成浏览器可直接用的 JS
// 修改 methodology.js 后运行本脚本重新生成
// （个人档案不在这里，它由前端 localStorage 提供，见「设置 → 我的档案」）
const fs = require("fs");
const path = require("path");
const { buildCommonText } = require("./methodology.js");

const OUT = path.join(__dirname, "..", "英雄资料", "promptdata.js");

const t = `// ⚠️ 本文件由 tools/make_promptdata.js 自动生成，不要手改
// 改通用方法论请改 tools/methodology.js，然后运行：
//   node tools/make_promptdata.js
// 个人档案（分段/位置/英雄池）由用户在「设置 → 我的档案」里填，存在浏览器本地。
window.PROMPT_DATA = {
  common: ${JSON.stringify(buildCommonText())},
};
`;

fs.writeFileSync(OUT, t, "utf8");
console.log(`✅ 已生成 ${path.basename(OUT)}  ${(Buffer.byteLength(t) / 1024).toFixed(1)} KB`);
