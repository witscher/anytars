# AGENTS.md

Instructions for coding agents (and humans) working on anytars. Read this before changing anything.

## What this is

An SVG avatar library: a person is a small JSON object of traits; `render(traits, variant, style)` draws them as an SVG string. The same person can be drawn in 18 expressions, 2 transforms (zombie, festive) and 5 styles and must stay recognizable. `encode`/`decode` turn traits into a short shareable code (`v1.…`).

Around the library: an avatar maker (`apps/maker`) on Cloudflare Workers with Workers AI (Clef models), a style lab (`apps/lab`), and QA tooling (`qa/`).

## Layout

| Path | Contents |
|---|---|
| `packages/core/src/anytars.js` | The whole library: geometry, parts, styles, expressions, `render`, `encode`, `decode`. Plain JavaScript, no dependencies, no build step needed to run it. |
| `packages/core/index.d.ts` | Public types. Update when the public API or `Traits` changes. |
| `packages/core/CODE-FORMAT.md` | The avatar code spec. A public contract. |
| `packages/core/test/` | `node:test` tests. |
| `apps/maker/public/index.html` | The maker page (UI, accordion editor, saving, undo, AI dock). Uses the global build. |
| `apps/maker/worker/worker.js` | Worker: static assets plus `/api/edit`, `/api/photo`, `/api/name` on Workers AI. |
| `apps/maker/worker/vocab.js` | What the AI may choose: every trait value with a short description the model reads. |
| `apps/lab/index.html` | Style lab page body (wrapped into a document by the build). |
| `apps/shared/cast.js` | Example characters (not part of the npm package). |
| `qa/` | Renderer QA (`run.cjs`, `qa.html`), contact sheets (`sheet.cjs`), AI evaluation (`eval-ai.mjs`). |
| `scripts/build.mjs` | Builds `dist/` (deployed site) and `build/lab-standalone.html`. |

## Commands

```bash
npm install
```

```bash
npm test
```

```bash
npm run qa
```

| Command | Use it when |
|---|---|
| `npm test` | Always, before you finish. Builds the package and runs the tests (old codes still decode, round-trips, every style x variant renders valid SVG). Fast. |
| `npm run qa` | After any drawing change. Renders 2,000 random avatars in every style and version and pixel-checks overlaps (hair over eyes, glasses off the eyes, skin past a beard, mouth outside the face, hats cut off, …). Needs Playwright with Chromium. The current baseline is 0 string errors and about 10 flagged avatars, all reviewed edge cases (narrow glasses on huge eyes, extreme slider combinations). A higher count means you broke something. |
| `node qa/sheet.cjs qa/flagged.png` | Renders the flagged avatars from the last QA run into one image so you can look at them. |
| `npm run eval:ai` | After changing `vocab.js` or the AI questions in `worker.js`. Sends about 1,000 prompts to the live endpoint, takes about an hour because of the rate limit, and must stay at or above 98%. Do not run it casually; it calls a paid API. |
| `npm run build` | Builds `dist/`. Needed to view the maker or lab locally (`npx wrangler dev`, or serve `dist/` statically for the pages without AI). |

Deploying (`npm run deploy`) is done by the maintainer only. Do not deploy, publish to npm, or change Cloudflare settings unless the maintainer asks you to.

## Rules that must not be broken

1. **The avatar code is append-only.** Never reorder, remove or resize fields in `encode`/`decode`. New fields go at the end and must decode as "default" when missing. See `CODE-FORMAT.md`. The fixture test in `packages/core/test/core.test.mjs` guards this; add a fixture when you add a field.
2. **Enums are append-only.** `ENUMS` comes from the key order of `FACES`, `HAIR_TOP`, `HAIR_BACK`, `EYES`, `BROWS`, `NOSES`, `HEADWEAR` and the explicit `facialHair` and `glasses` lists. Add new parts at the end of their object or list. Never rename or delete a key; a retired part keeps its key and draws a replacement.
3. **Identity stays fixed across versions.** Expressions may only change eyes, lids, brows, mouth, cheeks and small effects (tears, hearts, zZz). Face shape, hair, headwear, glasses and colours stay the same, so the person is recognizable in every version and style.
4. **One trait set, five styles.** Styles change proportions, lines, shading and eye drawing, never which parts exist. Every part must work in every style.
5. **`render` is pure.** No DOM, no globals other than `ANYTARS_CONFIG`, no randomness, no network. Same input gives the same SVG apart from internal ids.
6. **Every SVG id goes through `uid()`**, so many avatars on one page never clash.
7. **Every layer is wrapped with `tag('name', …)`** (`data-l` attribute). The QA harness depends on these names.
8. **Privacy in the Worker.** Photos are analysed once and discarded. Never store, cache or log request bodies, never add logging of user input, never echo input in errors.
9. **No dependencies in `packages/core`.**

## Adding things

**A hat or other headwear.** Append an entry to `HEADWEAR` in `anytars.js`. Draw it in oval-face coordinates and map points with `F.mp([...])`. Useful fields:

- `front(S, F, color, ctx, accent)` draws it.
- `hairMask` is the hat's lower edge, left to right. Hair above that edge and within the hat's width is hidden.
- `brimY` lifts the hat to keep the brows visible.
- `box` gives the extent, for fitting the avatar inside the canvas.
- `accent` and `accentLabel` give a second colour.
- `hideHairTop`, `hideHairBack` and `hideEars` hide those parts.

Then:

1. Add a description to `HEADWEAR` in `vocab.js` so the AI can choose it.
2. Add a label to `NICE` in the maker page if the key isn't readable.
3. Add it to the lab wardrobe list in `apps/lab/index.html`.
4. Run `npm test` and `npm run qa`.
5. Look at it in all five styles on a few characters, including long hair, an afro and glasses.

**A hairstyle.** Use `HAIR_TOP` or `HAIR_BACK`, and add `HAIR_TOP_Y` or `HAIR_BACK_Y`, which the hats and the canvas fitting use. Shapes must be solid: overlapping sub-paths must wind the same direction, or the nonzero fill rule leaves holes where the scalp shows.

**An expression.** Append to `EXPR` and `EXPRESSIONS`. Reuse existing eye and mouth options where possible. Then:

1. Add the mouth's vertical extent to the `EXT` table in `drawMouth`, so the mouth fit keeps it inside the face.
2. Add it to `Expression` in `index.d.ts` and to `EXPRESSION` in `vocab.js`.

**A trait field.** Do all of these together:

1. Add it to `Traits` in `index.d.ts`.
2. Append it to the end of `encode`/`decode`, keeping it optional on decode.
3. Add a fixture test.
4. Add an editor control in the maker.
5. Accept it in the Worker's `sanitize`.
6. Ask the maintainer whether the AI should learn it.

## How to check visual work

The QA harness catches overlaps and broken output, not ugliness. For any drawing change, also render the affected parts large and look at them. `qa/sample.cjs` and the lab page are useful for that. Check all five styles, at least one long-hair, one afro or curly, one beard and one glasses character, and the zombie and festive transforms. Small sizes matter (20–48 px), because avatars mostly appear small.

## Style of the code

- Plain modern JavaScript. Keep functions near the parts they draw.
- Round coordinates with `n1()`.
- Colours are hex strings; derive shades with `mix`, `darken` and `lighten`, never hard-code a per-style colour for a trait.
- Comments explain why, not what.
- Commit messages describe the user-visible change first.
