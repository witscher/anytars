@AGENTS.md

## Notes for Claude

- Look at your drawing changes. Render the affected avatars with Playwright (Chromium is usually available) at 150–300 px in all five styles, read the screenshot, and iterate before reporting. `qa/sheet.cjs` and `qa/sample.cjs` show the pattern: open `dist/lab/index.html` or `qa/qa.html`, call `render()` in the page, screenshot a grid.
- Run `npm test` before every commit and `npm run qa` after drawing changes; report the numbers (renders, string errors, flagged avatars) rather than "tests pass".
- `packages/core/src/anytars.js` is large. Search for the function or table you need (`HEADWEAR`, `EXPR`, `drawMouth`, `drawEye`, `render(`) instead of reading the whole file.
- Do not run `npm run eval:ai`, `npm run deploy` or `npm publish` unless the maintainer asks; the first calls a paid API for about an hour, the others change public state.
- When the maintainer sends reference images for a look, compare against them explicitly (size, colour, outline, shape) before showing results.

## Legal & privacy
Whoever deploys anytars is its operator and links to their own legal pages. Never put an operator's legal URLs, name or address in this repository.
- Every page and view links to the operator's central pages, reachable in one click: "Legal Notice" and "Privacy". The URLs are deployment settings: the Worker reads `LEGAL_IMPRINT_URL` and `LEGAL_PRIVACY_URL` (Worker variables in the Cloudflare dashboard, `.dev.vars` locally) and writes plain `<a>` links into each page's `[data-legal]` slot on the server (`withSiteMeta` in `apps/maker/worker/worker.js`), not in browser JavaScript. A new page needs a `data-legal` slot and its path in `run_worker_first` in `wrangler.jsonc`.
- Never create own legal notice, imprint, privacy, cookie or "legal" pages, texts or banners. Credits, sources and licence attributions are fine on a separate /credits page.
- Never put any postal address in this project.
- No analytics, tracking, ads, or third-party resources (fonts, scripts, images, iframes, CDNs). Serve fonts and assets from this project's own domain (`apps/shared/fonts`). Plain links to other sites (e.g. GitHub) are fine. If a third-party resource seems unavoidable, stop and ask.
- Data the operator's privacy policy must describe: browser storage (localStorage, sessionStorage, IndexedDB, cookies, Cache Storage/service worker), data in shareable links, and everything that reaches the server and relates to a visitor (photos, text descriptions, AI requests and responses, IP addresses, Workers Logs, AI Gateway logs, anything stored in R2, KV, D1 or Durable Objects). Whenever you add, remove or change any of these, tell the user and give a draft paragraph in English and German for the project-specific section of the operator's privacy policy: what is processed, where, why, by which service, and for how long. Do not try to edit the operator's site yourself.
- Never log photos, prompts, descriptions or other visitor input, and never put personal data in URLs or query strings, because request logs record them.
