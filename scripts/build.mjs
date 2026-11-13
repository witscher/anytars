// Builds everything that gets deployed into dist/:
//   /             avatar maker          apps/maker/public/index.html
//   /lab/         style lab             apps/lab/index.html (a page body, wrapped in a document here)
//   /anytars.js   renderer, global build (packages/core)
//   /cast.js      example characters    apps/shared/cast.js
//   /fonts/       self-hosted fonts     apps/shared/fonts (WOFF2 + SIL OFL licences)
// The Worker (apps/maker/worker) imports packages/core/src directly; wrangler bundles it.
// Also writes build/lab-standalone.html: the lab with everything inlined, as a single shareable file.
import { mkdir, readFile, readdir, writeFile, copyFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

execFileSync(process.execPath, ['packages/core/scripts/build.mjs'], { stdio: 'inherit' });

const OUT = 'dist';
const core = await readFile('packages/core/dist/anytars.global.js', 'utf8');
const cast = await readFile('apps/shared/cast.js', 'utf8');
const lab = await readFile('apps/lab/index.html', 'utf8');

const doc = (body, extraHead = '') => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="anytars style lab: the example characters in every style, expression and transform.">
<meta property="og:type" content="website">
<meta property="og:site_name" content="anytars">
<meta property="og:title" content="anytars style lab">
<meta property="og:description" content="The anytars example characters in every style, expression and transform. Open source avatars for humans in their diversity.">
<meta property="og:url" content="/lab/">
<meta property="og:image" content="/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="627">
<meta property="og:image:alt" content="The anytars logo next to six cartoon avatars of different people in five drawing styles">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<style>
:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}
body{margin:0;font:14px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
img{max-width:100%}
[hidden]{display:none!important}
.backlink{display:inline-block;margin:14px 0 0;font:500 .9rem system-ui,sans-serif;color:inherit}
.site-foot{max-width:1180px;margin:32px auto 24px;padding:0 16px;display:flex;gap:14px;flex-wrap:wrap;font:.84rem system-ui,sans-serif;opacity:.75}
.site-foot a{color:inherit}
</style>${extraHead}
</head>
<body>
<div style="max-width:1180px;margin:0 auto"><a class="backlink" href="/">&larr; Make your own avatar</a></div>
${body}
<footer class="site-foot"><a href="/">anytars</a><a href="https://github.com/witscher/anytars">Source on GitHub</a><span class="legal" data-legal style="display:contents"></span></footer>
</body>
</html>
`;

const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#d6246e"/><circle cx="32" cy="30" r="17" fill="#f2cfae"/><path d="M15 28 Q16 11 32 11 Q48 11 49 28 Q42 19 32 20 Q22 19 15 28Z" fill="#1d1a1f"/><circle cx="26" cy="31" r="2.6" fill="#1d1a1f"/><circle cx="38" cy="31" r="2.6" fill="#1d1a1f"/><path d="M26 38 Q32 43 38 38" fill="none" stroke="#1d1a1f" stroke-width="2.4" stroke-linecap="round"/></svg>`;

await mkdir(`${OUT}/lab`, { recursive: true });
await copyFile('apps/maker/public/index.html', `${OUT}/index.html`);
await writeFile(`${OUT}/lab/index.html`, doc(lab));
await writeFile(`${OUT}/anytars.js`, core);
await writeFile(`${OUT}/cast.js`, cast);
await writeFile(`${OUT}/favicon.svg`, favicon);
await copyFile('apps/maker/public/og.png', `${OUT}/og.png`);   // social preview, made by scripts/og-image.cjs
// Fonts are served from this site (no third-party requests), with their licences.
await mkdir(`${OUT}/fonts`, { recursive: true });
for (const f of await readdir('apps/shared/fonts')) await copyFile(`apps/shared/fonts/${f}`, `${OUT}/fonts/${f}`);

// Standalone lab (no external scripts): used for sharing the lab as one file.
await mkdir('build', { recursive: true });
const inline = lab.replace('<script src="/anytars.js"></script>\n<script src="/cast.js"></script>\n',
  `<script>\n${core}</script>\n<script>\n${cast}</script>\n`);
await writeFile('build/lab-standalone.html', inline);
console.log(`Built ${OUT}/ (maker, lab, anytars.js ${core.length} bytes, cast.js) and build/lab-standalone.html`);
