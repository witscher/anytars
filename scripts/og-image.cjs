// Renders the social preview image (Open Graph / X card, 1200x627) from the library and the cast:
//   npm run build && node scripts/og-image.cjs   ->  apps/maker/public/og.png
// Needs Playwright with Chromium (as the QA scripts do). Re-run when the cast or the look changes.
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const ROOT = 'file://' + path.resolve(__dirname, '..');
const HTML = `<!doctype html><html><head><meta charset="utf-8">
<style>
@font-face{font-family:'Bricolage Grotesque';font-weight:200 800;src:url(ROOT/apps/shared/fonts/bricolage-grotesque-latin-opsz-normal.woff2) format('woff2')}
@font-face{font-family:'Inter';font-weight:100 900;src:url(ROOT/apps/shared/fonts/inter-latin-wght-normal.woff2) format('woff2')}
html,body{margin:0}
#c{width:1200px;height:627px;box-sizing:border-box;background:#eef0f5;display:grid;grid-template-columns:470px 1fr;align-items:center;padding:0 56px;gap:24px;font-family:Inter,sans-serif;color:#1b1a22;position:relative;overflow:hidden}
#c:before{content:"";position:absolute;right:-120px;top:-160px;width:620px;height:620px;border-radius:50%;background:#fbe3ee}
.l{position:relative}
.brand{display:flex;align-items:center;gap:16px}
.brand svg{width:72px;height:72px}
h1{font:800 84px/1 'Bricolage Grotesque';letter-spacing:-.03em;margin:0}
p{font-size:30px;line-height:1.3;margin:28px 0 0;font-weight:500}
.s{font-size:21px;color:#5b5e6e;margin-top:22px;font-weight:500}
.g{position:relative;display:grid;grid-template-columns:repeat(3,190px);gap:18px;justify-content:center}
.g div{width:190px;height:190px;border-radius:28px;overflow:hidden;background:#fff;box-shadow:0 6px 18px rgba(27,26,34,.08)}
.g svg{width:190px;height:190px;display:block}
</style></head><body><div id="c"><div class="l">
<div class="brand"><svg viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#d6246e"/><circle cx="32" cy="30" r="17" fill="#f2cfae"/><path d="M15 28 Q16 11 32 11 Q48 11 49 28 Q42 19 32 20 Q22 19 15 28Z" fill="#1d1a1f"/><circle cx="26" cy="31" r="2.6" fill="#1d1a1f"/><circle cx="38" cy="31" r="2.6" fill="#1d1a1f"/><path d="M26 38 Q32 43 38 38" fill="none" stroke="#1d1a1f" stroke-width="2.4" stroke-linecap="round"/></svg><h1>anytars</h1></div>
<p>Make your avatar from a photo or a sentence. One person, many moods, five styles.</p>
<div class="s">Open source &middot; Cloudflare Workers AI</div>
</div><div class="g" id="g"></div></div>
<script src="ROOT/dist/anytars.js"></script><script src="ROOT/dist/cast.js"></script>
<script>
const pick=[['abena','cel',{expression:'laughing'}],['harpreet','chibi',{expression:'happy'}],['wren','anime',{expression:'wink'}],['mateo','sticker',{expression:'surprised'}],['amira','flat',{expression:'happy'}],['kenji','cel',{expression:'heartEyes'}]];
document.getElementById('g').innerHTML=pick.map(([id,st,v])=>'<div>'+render(CAST.find(c=>c.id===id),v,st)+'</div>').join('');
</script></body></html>
`;
(async () => {
  const tmp = path.resolve(__dirname, '..', 'build', 'og.html');
  fs.mkdirSync(path.dirname(tmp), { recursive: true });
  fs.writeFileSync(tmp, HTML.replaceAll('ROOT', ROOT));
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1200, height: 627 } });
  await p.goto('file://' + tmp); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
  await (await p.$('#c')).screenshot({ path: path.resolve(__dirname, '..', 'apps/maker/public/og.png') });
  await b.close(); console.log('wrote apps/maker/public/og.png');
})();
