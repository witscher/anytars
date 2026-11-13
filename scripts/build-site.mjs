// Builds the deployable site from the style lab page.
// The lab file is authored as a page body (no <html>/<head>), so this wraps it
// in a full document with the base styles the page expects.
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const SRC = 'explorations/style-v1/index.html';
const OUT = 'dist';

const body = await readFile(SRC, 'utf8');
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="anytars: an open avatar library for humans in their diversity. Style lab with expressions, transforms and Mii-style tuning.">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<style>
:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}
body{margin:0;font:14px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
img{max-width:100%}
[hidden]{display:none!important}
</style>
</head>
<body>
${body}
</body>
</html>
`;

const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#d6246e"/><circle cx="32" cy="30" r="17" fill="#f2cfae"/><path d="M15 28 Q16 11 32 11 Q48 11 49 28 Q42 19 32 20 Q22 19 15 28Z" fill="#1d1a1f"/><circle cx="26" cy="31" r="2.6" fill="#1d1a1f"/><circle cx="38" cy="31" r="2.6" fill="#1d1a1f"/><path d="M26 38 Q32 43 38 38" fill="none" stroke="#1d1a1f" stroke-width="2.4" stroke-linecap="round"/></svg>`;

await mkdir(OUT, { recursive: true });
await writeFile(`${OUT}/index.html`, html);
await writeFile(`${OUT}/favicon.svg`, favicon);
console.log(`Built ${OUT}/index.html (${html.length} bytes)`);
