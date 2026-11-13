@AGENTS.md

## Notes for Claude

- Look at your drawing changes. Render the affected avatars with Playwright (Chromium is usually available) at 150–300 px in all five styles, read the screenshot, and iterate before reporting. `qa/sheet.cjs` and `qa/sample.cjs` show the pattern: open `dist/lab/index.html` or `qa/qa.html`, call `render()` in the page, screenshot a grid.
- Run `npm test` before every commit and `npm run qa` after drawing changes; report the numbers (renders, string errors, flagged avatars) rather than "tests pass".
- `packages/core/src/anytars.js` is large. Search for the function or table you need (`HEADWEAR`, `EXPR`, `drawMouth`, `drawEye`, `render(`) instead of reading the whole file.
- Do not run `npm run eval:ai`, `npm run deploy` or `npm publish` unless the maintainer asks; the first calls a paid API for about an hour, the others change public state.
- When the maintainer sends reference images for a look, compare against them explicitly (size, colour, outline, shape) before showing results.
