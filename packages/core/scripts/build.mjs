// Builds the package from src/anytars.js:
//   dist/anytars.mjs        ES module (Node, bundlers, Workers)
//   dist/anytars.cjs        CommonJS (require), with index.d.cts as its types
//   dist/anytars.global.js  classic script; every top-level name becomes a browser global (render, encode, ...)
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const src = await readFile(root + 'src/anytars.js', 'utf8');
const { version } = JSON.parse(await readFile(root + 'package.json', 'utf8'));
const banner = `/*! anytars ${version} */\n`;
const exportStart = src.lastIndexOf('\nexport {');
if (exportStart < 0) throw new Error('export block not found in src/anytars.js');

await mkdir(root + 'dist', { recursive: true });
await writeFile(root + 'dist/anytars.mjs', banner + src.replace(/^const ANYTARS_VERSION = .*$/m, ''));
await writeFile(root + 'dist/anytars.global.js', banner + '"use strict";\n' + src.slice(0, exportStart) + '\n');
const names = src.slice(exportStart).match(/\{([^}]*)\}/)[1].split(',').map(s => s.trim()).filter(Boolean);
await writeFile(root + 'dist/anytars.cjs', banner + '"use strict";\n' + src.slice(0, exportStart) + `\nmodule.exports = { ${names.join(', ')} };\n`);
await copyFile(root + 'index.d.ts', root + 'index.d.cts');
console.log(`anytars ${version}: dist/anytars.mjs, dist/anytars.cjs, dist/anytars.global.js`);
