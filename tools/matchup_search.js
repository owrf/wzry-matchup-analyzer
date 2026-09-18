// 对位情报搜索（多源 + 来源质量分级）
//
// 来源分级：
//   A 级（真人内容）  B站 —— 玩家/UP 主实测，可信度较高
//   B 级（可能是 AI 生成） 内容农场/攻略站 —— 必须标注"疑似 AI 生成，不完全可信"
//
// 原则：允许用 B 级来源，但**必须在情报里明确标注不可信**，让 AI 知道要打折
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const H = { "User-Agent": UA, "Referer": "https://www.bilibili.com/", "Accept-Language": "zh-CN,zh;q=0.9" };
const clean = (s) => String(s || "").replace(/<[^>]+>/g, " ").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

const intel_keys = ["线权", "清线", "推线", "抢线", "线霸", "对线", "压制", "消耗", "克制", "难打", "好打", "打不过", "随便打", "弱势", "强势"];

// ---------- 来源质量分级 ----------
const FARM_DOMAINS = ["sohu.com", "youliaogames", "18183", "9game", "87g", "k73", "pc6", "yxdown",
  "ali213", "gamersky", "duote", "qqtn", "bianfeng", "gao7", "xin.07073", "shouyou", "yxbao",
  "pipaw", "jb51", "u9", "40407", "zhuangjibang", "wbzhan", "h5.gao7"];
function gradeOf(url) {
  if (!url) return { grade: "B", label: "来源不明" };
  if (/bilibili\.com/.test(url)) return { grade: "A", label: "B站（真人内容）" };
  if (/douyin\.com/.test(url)) return { grade: "A", label: "抖音（真人内容）" };
  if (/zhihu\.com|nga\.cn|ngabbs/.test(url)) return { grade: "A", label: "社区讨论" };
  if (FARM_DOMAINS.some(d => url.includes(d))) return { grade: "B", label: "⚠️ 攻略站/内容农场（疑似 AI 生成，不完全可信）" };
  return { grade: "B", label: "⚠️ 普通网页（未核实，不完全可信）" };
}

// ---------- B站（A 级）----------
async function biliSearch(kw, tries) {
  tries = tries || 2;
  const url = `https://api.bilibili.com/x/web-interface/search/type?search_type=video&keyword=${encodeURIComponent(kw)}&order=click`;
  for (let i = 1; i <= tries; i++) {
    try {
      const r = await fetch(url, { headers: H });
      const t = await r.text();
      if (t.startsWith("{")) {
        const j = JSON.parse(t);
        if (j.code === 0) return { list: (j.data.result || []).slice(0, 10) };
        if (j.code === -412 || j.code === -509) { await new Promise(s => setTimeout(s, 1500 * i)); continue; }
        return { err: "code=" + j.code };
      }
      await new Promise(s => setTimeout(s, 1500 * i));
    } catch (e) { await new Promise(s => setTimeout(s, 1000 * i)); }
  }
  return { err: "B站限流" };
}

// ---------- 网页搜索（B 级，需要标注）----------
// 用 Bing（返回结构相对稳定）。只取标题+摘要+链接，不做深度抓取。
// ---------- 中文网页搜索（B 级：内容农场/攻略站，必须标注）----------
// Bing 中文搜索会把"狂铁 对线 芈月"拆成单字查询（给字典释义），所以用百度和搜狗
async function webSearch(kw) {
  const out = [];
  const seen = new Set();
  const push = (title, url, snippet) => {
    if (!title || seen.has(title)) return;
    seen.add(title);
    out.push({ title, url: url || "", snippet: snippet || "", ...gradeOf(url) });
  };

  // 百度
  try {
    const r = await fetch(`https://www.baidu.com/s?wd=${encodeURIComponent(kw)}`, {
      headers: { "User-Agent": UA, "Accept-Language": "zh-CN,zh;q=0.9" },
    });
    const html = await r.text();
    const re = /<h3[^>]*class="[^"]*t[^"]*"[^>]*>[\s\S]{0,300}?<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
    let m;
    while ((m = re.exec(html)) && out.length < 8) push(clean(m[2]), m[1], "");
  } catch (e) { }

  // 搜狗（内容农场收录更多）
  try {
    await new Promise(s => setTimeout(s, 1200));
    const r = await fetch(`https://www.sogou.com/web?query=${encodeURIComponent(kw)}`, {
      headers: { "User-Agent": UA, "Accept-Language": "zh-CN,zh;q=0.9" },
    });
    const html = await r.text();
    const re = /<h3[^>]*>([\s\S]*?)<\/h3>[\s\S]{0,600}?href="([^"]+)"/g;
    let m;
    while ((m = re.exec(html)) && out.length < 14) {
      const t = clean(m[1]);
      const u = m[2].startsWith("/link") ? "https://www.sogou.com" + m[2] : m[2];
      push(t, u, "");
    }
  } catch (e) { }

  return { list: out };
}

// 从文本里抽情报片段
function snippetsOf(text, source) {
  const out = [];
  const txt = clean(text);
  for (const k of intel_keys) {
    let i = txt.indexOf(k);
    while (i >= 0 && out.length < 2) {
      out.push({ key: k, s: txt.slice(Math.max(0, i - 35), i + 55), source });
      i = txt.indexOf(k, i + k.length);
    }
  }
  return out;
}

// ---------- 主函数 ----------
async function searchMatchup(a, b) {
  const kw = `${a} 对线 ${b}`;
  const videos = [], pages = [], errs = [];

  // A 级：B站
  const br = await biliSearch(kw);
  if (br.err) errs.push("B站: " + br.err);
  else {
    for (const v of br.list) {
      const title = clean(v.title), desc = clean(v.description || "");
      if (!title.includes(a) && !title.includes(b) && !desc.includes(a) && !desc.includes(b)) continue;
      videos.push({
        bvid: v.bvid, title, author: v.author, play: v.play || 0,
        both: title.includes(a) && title.includes(b),
        versus: /对线|打|如何|怎么|克制|怕|vs/i.test(title),
      });
    }
  }

  // B 级：网页（内容农场等），必须标注
  await new Promise(s => setTimeout(s, 1500));
  const wr = await webSearch(kw);
  if (wr.err) errs.push("网页: " + wr.err);
  else {
    for (const p of wr.list) {
      if (!p.title.includes(a) && !p.title.includes(b) &&
          !p.snippet.includes(a) && !p.snippet.includes(b)) continue;
      pages.push(p);
    }
  }

  videos.sort((x, y) => (y.both - x.both) || (y.versus - x.versus) || (y.play - x.play));

  // 情报片段（标上来来源等级）
  const intel = [];
  for (const v of videos.slice(0, 6)) {
    for (const s of snippetsOf(v.title + " " + (v.desc || ""), "A")) {
      if (!intel.some(x => x.s === s.s)) intel.push({ ...s, from: v.title });
    }
  }
  for (const p of pages.slice(0, 6)) {
    for (const s of snippetsOf(p.title + " " + p.snippet, "B")) {
      if (!intel.some(x => x.s === s.s)) intel.push({ ...s, from: p.title, url: p.url });
    }
  }

  return {
    ok: videos.length > 0 || pages.length > 0,
    err: errs.join("；"),
    videos: videos.slice(0, 8),
    pages: pages.slice(0, 8),
    intel: intel.slice(0, 14),
  };
}

// ---------- 生成给 AI 的情报文本 ----------
function intelText(r, a, b) {
  if (!r || !r.ok) return "";
  const L = [];
  L.push(`## 社区/网络情报（搜索"${a} 对线 ${b}"）`);
  L.push(`这些是网上的说法，**不是权威结论**。请按来源等级判断可信度，与官方技能原文冲突时以技能原文为准。`);
  L.push("");

  if (r.videos.length) {
    L.push(`### 【可信度较高】B站真人内容`);
    r.videos.forEach(v => L.push(`- ${v.title}（UP:${v.author}，${v.play.toLocaleString()}播放）`));
    L.push("");
  }
  if (r.pages.length) {
    L.push(`### ⚠️【疑似 AI 生成，不完全可信】攻略站/内容农场`);
    L.push(`**这类内容可能是 AI 批量生成的，只当参考，不要直接采信。**`);
    r.pages.forEach(p => L.push(`- ${p.title}　（${p.label}）`));
    L.push("");
  }
  if (r.intel.length) {
    L.push(`### 关键词片段（A=真人内容 / B=疑似AI生成）`);
    r.intel.forEach(x => L.push(`- [${x.key}][${x.source}级] ${x.s}`));
  }
  return L.join("\n");
}

module.exports = { searchMatchup, intelText, gradeOf };
