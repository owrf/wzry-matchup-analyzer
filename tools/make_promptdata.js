// 把 Node 端的提示词材料打包成浏览器可直接用的 JS
// 修改 methodology.js / profile.js 后，运行本脚本重新生成
const fs = require("fs");
const path = require("path");
const { buildCommonText } = require("./methodology.js");
const { buildProfileText } = require("./profile.js");

const OUT = path.join(__dirname, "..", "英雄资料", "promptdata.js");

const t = `// ⚠️ 本文件由 tools/make_promptdata.js 自动生成，不要手改
// 改提示词请改 tools/methodology.js（通用方法论）或 tools/profile.js（个人档案），然后运行：
//   node tools/make_promptdata.js
window.PROMPT_DATA = {
  profile: ${JSON.stringify(buildProfileText())},
  common: ${JSON.stringify(buildCommonText())},
};
`;

fs.writeFileSync(OUT, t, "utf8");
console.log(`✅ 已生成 ${path.basename(OUT)}  ${(Buffer.byteLength(t) / 1024).toFixed(1)} KB`);
