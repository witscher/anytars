// Builds the package from src/anytars.js:
//   dist/anytars.mjs        ES module (Node, bundlers, Workers)
//   dist/anytars.global.js  classic script; every top-level name becomes a browser global (render, encode, ...)
import { mkdir, readFile, writeFile } from 'node:fs/promises';
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
console.log(`anytars ${version}: dist/anytars.mjs, dist/anytars.global.js`);
