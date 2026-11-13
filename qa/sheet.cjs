// node sheet.js <out.png> [kindFilter] [max]
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
(async () => {
  const [out, kind, max] = [process.argv[2], process.argv[3] || '', +(process.argv[4] || 60)];
  const r = JSON.parse(fs.readFileSync(path.join(__dirname, 'results.json')));
  const items = r.rasterFlags.filter(x => !kind || x.flags.some(f => f.k === kind)).slice(0, max);
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1500, height: 900 } });
  await p.goto('file://' + path.join(__dirname, 'qa.html'));
  await p.evaluate((items) => {
    document.body.style.margin = 0;
    document.body.innerHTML = '<div id="g" style="display:grid;grid-template-columns:repeat(10,140px);gap:6px;padding:6px;background:#e9ebf0;font:10px/1.2 sans-serif"></div>';
    items.forEach(x => {
      const t = decode(x.code);
      document.getElementById('g').insertAdjacentHTML('beforeend', `<div style="background:#fff;border-radius:6px;padding:2px">${render(t,{expression:'neutral'},x.st,{background:'none',backgroundShape:'none'}).replace('<svg ','<svg width="136" height="136" ')}<div>#${x.i} ${x.st}<br>${x.flags.map(f=>f.k+' '+f.v).join('<br>')}<br>${t.hair.top}/${t.hair.back} ${t.headwear.type} ${t.glasses.type} ${t.facialHair}</div></div>`);
    });
  }, items);
  await (await p.$('#g')).screenshot({ path: out });
  console.log('items', items.length);
  await b.close();
})();
