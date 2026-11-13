# anytars

Open-source SVG avatar library for humans in their diversity. Every person has one recognizable avatar plus versions of it: 18 expressions (happy, crying, wink, shrug, upside down, …), zombie and festive transforms, in five art styles.

Live: https://anytars.davebuilds.net (avatar maker with Cloudflare Workers AI) and https://anytars.davebuilds.net/lab/ (style lab).

A personal project that showcases Cloudflare technology (Workers, static assets, Workers AI). It is not a Cloudflare product.

## Repository layout

| Path | What |
|---|---|
| `packages/core` | The library (`anytars` on npm, not published yet): renderer, avatar code, types, tests. `CODE-FORMAT.md` is the avatar code spec. |
| `apps/maker` | The avatar maker: `public/index.html` (the page) and `worker/` (Cloudflare Worker with the Workers AI endpoints). |
| `apps/lab` | The style lab: every person in every style and version, eye variants, tuning, wardrobe. |
| `apps/shared/cast.js` | Example characters used by the maker and the lab (not part of the library). |
| `qa/` | Renderer QA over thousands of random avatars, and the AI evaluation. |
| `scripts/build.mjs` | Builds `dist/` for deployment. |

## Develop

```bash
npm install
```

```bash
npm test
```

```bash
npm run qa
```

```bash
npm run deploy
```

- `npm test` builds the library and runs its tests: old avatar codes still decode, codes round-trip, every style and version renders valid SVG.
- `npm run qa` renders 2,000 random avatars in every style and version (about 360,000 SVGs) and pixel-checks layer overlaps; see `qa/README.md`.
- `npm run eval:ai` runs about 1,000 natural-language edits against the live AI endpoint and reports the pass rate.
- `npm run deploy` builds and publishes the `anytars` Worker: static assets, the `/api/*` routes, a Workers AI binding and a rate limit, on the custom domain in `wrangler.jsonc`. Needs `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

## Workers AI

The maker changes an avatar from a sentence ("long blonde hair and round glasses"), creates one from a description or a photo, and checks avatar names. All of it runs on Workers AI with Cloudflare's **Clef** decision models, from `apps/maker/worker/worker.js`:

- `POST /api/edit` sends the request and the current avatar to `@cf/cloudflare/clef-flash`. Every trait is one typed `choice` question whose options are the exact values the renderer supports, plus `keep`; yes/no questions check whether the request mentions each part at all. One call answers about 50 questions in a few hundred milliseconds. A trait changes only when the model is confident, so unrelated parts stay put. It also tells edits from descriptions of a new character, with presentation and age as hints for the random parts.
- `POST /api/photo` sends a downscaled JPEG to `@cf/cloudflare/clef-omni` with the same questions. Skin tone is a `score` question, so it can fall between palette steps.
- `POST /api/name` checks an avatar name with Clef flash: four yes/no questions (profanity, hate or harassment, sexual content, violence or extremism) over the name as typed and a decoded spelling (`sh1t` → `shit`, separators removed). Real names that look rude (Dick, Fanny, Randy, Gay, Phuc, Bich, Hung, Cox, …) are on an allow-list: they are masked for those checks, and the original name gets two extra questions with stricter limits, so "Dick Smith" passes while "Dick Head" does not.
- Option labels and descriptions live in `apps/maker/worker/vocab.js`. The Worker imports the library from `packages/core` to validate traits and return avatar codes.

Photos are resized and re-encoded in the browser (removing EXIF data), sent once, analysed and discarded. The Worker never stores or logs request bodies, observability logging is off, and Workers AI lists Clef as zero data retention. A per-IP rate limit protects the AI endpoints.
