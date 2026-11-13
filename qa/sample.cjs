// node sample.js <out.png> <seedOffset> -- 70 random avatars, random style and version, no background
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const [out, off] = process.argv.slice(2);
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1500, height: 900 } });
  await p.goto('file://' + path.join(__dirname, 'qa.html'));
  await p.evaluate((off) => {
    document.body.style.margin = 0;
    document.body.innerHTML = '<div id="g" style="display:grid;grid-template-columns:repeat(10,144px);gap:4px;padding:4px;background:#e9ebf0;font:10px sans-serif"></div>';
    const styles = Object.keys(STYLES);
    for (let k = 0; k < 70; k++){
      const i = 50000 + off*100 + k, t = randomAvatar(i), r = mulberry32(i*7);
      const st = styles[Math.floor(r()*styles.length)], v = VARIANTS[Math.floor(r()*VARIANTS.length)];
      document.getElementById('g').insertAdjacentHTML('beforeend', `<div style="background:#fff">${render(t, v, st, {background:'none', backgroundShape:'none'}).replace('<svg ','<svg width="144" height="144" ')}<div>${k} ${st} ${variantLabel(v)}</div></div>`);
    }
  }, +off);
  await (await p.$('#g')).screenshot({ path: out });
  await b.close();
})();
