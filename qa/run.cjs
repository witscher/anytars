// node run.js <total> <workers>
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
(async () => {
  const total = +process.argv[2] || 2000, W = +process.argv[3] || 4, dir = __dirname;
  const b = await chromium.launch();
  const per = Math.ceil(total / W), t0 = Date.now();
  const results = await Promise.all([...Array(W)].map(async (_, w) => {
    const p = await b.newPage();
    p.on('pageerror', e => console.error('pageerror', e.message));
    await p.goto('file://' + path.join(dir, 'qa.html'));
    return p.evaluate(([s, n]) => runChunk(s, n), [w * per, Math.min(per, total - w * per)]);
  }));
  const merged = { strErrors: [], rasterFlags: [], renders: 0, parsed: 0 };
  results.forEach(r => { merged.strErrors.push(...r.strErrors); merged.rasterFlags.push(...r.rasterFlags); merged.renders += r.renders; merged.parsed += r.parsed; });
  fs.writeFileSync(path.join(dir, 'results.json'), JSON.stringify(merged, null, 1));
  const byKind = {};
  merged.rasterFlags.forEach(r => r.flags.forEach(f => { const k = f.k + ' @' + r.st; byKind[k] = (byKind[k] || 0) + 1; }));
  const strKinds = {}; merged.strErrors.forEach(e => { const k = e.err.split(':')[0] + ' @' + e.st; strKinds[k] = (strKinds[k] || 0) + 1; });
  console.log(JSON.stringify({ seconds: Math.round((Date.now() - t0) / 1000), avatars: total, renders: merged.renders, xmlParsed: merged.parsed, strErrors: merged.strErrors.length, strKinds, flaggedAvatars: merged.rasterFlags.length, byKind }, null, 1));
  await b.close();
})();
