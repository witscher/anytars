// Builds the deployable site into dist/:
//   /            avatar maker (site/index.html)
//   /lab/        style lab (explorations/style-v1/index.html, wrapped in a full document)
//   /anytars.js  renderer core, extracted from the lab between @anytars-core markers
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const LAB = 'explorations/style-v1/index.html';
const OUT = 'dist';

const lab = await readFile(LAB, 'utf8');
const m = lab.match(/\/\* @anytars-core:start \*\/([\s\S]*?)\/\* @anytars-core:end \*\//);
if (!m) throw new Error('Renderer core markers not found in ' + LAB);
const core = `/*! anytars renderer (prototype) - traits + variant + style -> SVG */\n"use strict";\n${m[1].trim()}\n`;

const labHtml = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="anytars style lab: compare candidate styles, expressions and transforms.">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<style>
:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}
body{margin:0;font:14px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
img{max-width:100%}
[hidden]{display:none!important}
.backlink{display:inline-block;margin:14px 0 0;font:500 .9rem system-ui,sans-serif;color:inherit}
</style>
</head>
<body>
<div style="max-width:1180px;margin:0 auto"><a class="backlink" href="/">&larr; Make your own avatar</a></div>
${lab}
</body>
</html>
`;

const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#d6246e"/><circle cx="32" cy="30" r="17" fill="#f2cfae"/><path d="M15 28 Q16 11 32 11 Q48 11 49 28 Q42 19 32 20 Q22 19 15 28Z" fill="#1d1a1f"/><circle cx="26" cy="31" r="2.6" fill="#1d1a1f"/><circle cx="38" cy="31" r="2.6" fill="#1d1a1f"/><path d="M26 38 Q32 43 38 38" fill="none" stroke="#1d1a1f" stroke-width="2.4" stroke-linecap="round"/></svg>`;

await mkdir(`${OUT}/lab`, { recursive: true });
await writeFile(`${OUT}/index.html`, await readFile('site/index.html', 'utf8'));
await writeFile(`${OUT}/lab/index.html`, labHtml);
await writeFile(`${OUT}/anytars.js`, core);
await writeFile(`${OUT}/favicon.svg`, favicon);
console.log(`Built ${OUT}/ (maker, lab, anytars.js ${core.length} bytes)`);
