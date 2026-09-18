// 抓官网英雄页「原始 HTML」，从 skill-name / skill-desc 解析全部技能
// 用法: node fetch_hero_html.js [起始] [数量]
const CDP = "http://127.0.0.1:9222";
const fs = require("fs");
const path = require("path");

const RAW = path.join(__dirname, "..", "heroes_raw", "html");
fs.mkdirSync(RAW, { recursive: true });
const BASE = "https://pvp.qq.com/web201605/herodetail/";

function conn(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0; const pend = new Map();
  const ready = new Promise((r) => { ws.onopen = r; });
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
  const send = (method, params = {}) => new Promise((res, rej) => {
    const i = ++id;
    pend.set(i, (m) => m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result));
    ws.send(JSON.stringify({ id: i, method, params }));
    setTimeout(() => { if (pend.has(i)) { pend.delete(i); rej(new Error("timeout " + method)); } }, 40000);
  });
  return { ws, ready, send };
}

(async () => {
  const list0 = await (await fetch(CDP + "/json/list")).json();
  let lp = list0.find((t) => t.url.includes("herolist"));
  if (!lp) { console.log("请先在浏览器打开官网英雄列表页"); return; }
  const lc = conn(lp.webSocketDebuggerUrl); await lc.ready;
  const sl = await lc.send("Runtime.evaluate", {
    expression: `JSON.stringify([...document.querySelectorAll('a[href*="herodetail"]')].map(a=>{
      const img=a.querySelector('img');
      return { slug:(a.getAttribute('href')||'').replace(/^herodetail\\//,'').replace(/\\.shtml$/,''),
               name:(img&&img.alt)||a.textContent.trim() };
    }).filter(x=>x.name&&x.slug))`, returnByValue: true, awaitPromise: true,
  });
  const heroes = JSON.parse(sl.result.value);
  fs.writeFileSync(path.join(__dirname, "..", "英雄资料", "_官网英雄列表.json"), JSON.stringify(heroes, null, 1), "utf8");
  console.log(`英雄数：${heroes.length}`);

  // 工作页（用官网同源页面，才能 fetch 官网）
  let wp = list0.find((t) => t.url.includes("pvp.qq.com") && !t.url.includes("herolist"));
  if (!wp) {
    const nr = await fetch(`${CDP}/json/new?${encodeURIComponent("https://pvp.qq.com/web201605/herodetail/105.shtml")}`, { method: "PUT" });
    const wt = await nr.json();
    await new Promise((s) => setTimeout(s, 6000));
    wp = (await (await fetch(CDP + "/json/list")).json()).find((x) => x.id === wt.id);
  }
  const wc = conn(wp.webSocketDebuggerUrl); await wc.ready;

  const from = parseInt(process.argv[2] || "0");
  const count = parseInt(process.argv[3] || String(heroes.length));
  let ok = 0, fail = 0;

  for (let i = from; i < Math.min(heroes.length, from + count); i++) {
    const h = heroes[i];
    const outFile = path.join(RAW, `${h.slug}.html`);
    if (fs.existsSync(outFile) && fs.statSync(outFile).size > 5000) { console.log(`CACHED ${i} ${h.name}`); ok++; continue; }
    try {
      const r = await wc.send("Runtime.evaluate", {
        expression: `(async () => {
          const r = await fetch(${JSON.stringify(BASE + h.slug + ".shtml")}, {credentials:'include'});
          const buf = await r.arrayBuffer();
          let t; try { t = new TextDecoder('gbk').decode(buf); } catch(e){ t = new TextDecoder('utf-8').decode(buf); }
          return t;
        })()`, returnByValue: true, awaitPromise: true,
      });
      const html = r.result.value || "";
      fs.writeFileSync(outFile, html, "utf8");
      const nSkill = (html.match(/class="skill-name"/g) || []).length;
      console.log(`${nSkill >= 3 ? "OK  " : "WARN"} ${String(i).padStart(3)} ${h.name}  ${html.length}字  技能${nSkill}个`);
      ok++;
      await new Promise((s) => setTimeout(s, 250));
    } catch (e) { fail++; console.log(`FAIL ${i} ${h.name} ${e.message}`); }
  }
  console.log(`\n完成：成功 ${ok}，失败 ${fail}`);
  wc.ws.close(); lc.ws.close();
})();
