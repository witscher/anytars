# anytars

Open-source SVG avatar library for humans in their diversity. Every person has one recognizable base avatar plus versions of it: expressions (happy, sad, crying, ...) and transforms (zombie, festive, ...).

Live style lab: https://anytars.davebuilds.net

## Status

Style exploration. `explorations/style-v1/index.html` holds a prototype renderer (traits JSON + variant + style -> SVG), the cast, Mii-style tuning sliders and a reversible avatar code (`v1.` + base64url).

## Workers AI

The maker at `/` can change an avatar from a sentence ("long blonde hair and round glasses") or create one from a photo. Both run on Workers AI with Cloudflare's **Clef** decision models, from the Worker in `src/worker.js`:

- `POST /api/edit` sends the request and the current avatar to `@cf/cloudflare/clef-flash`. Every trait is one typed `choice` question whose options are the exact values the renderer supports, plus `keep`. One call answers about 34 questions in a few hundred milliseconds. A trait changes only when `keep` is below 20%, so unrelated parts stay put.
- `POST /api/photo` sends a downscaled JPEG to `@cf/cloudflare/clef-omni` with the same questions (no `keep`). Skin tone is a `score` question, so it can fall between palette steps.
- Option labels and descriptions live in `src/vocab.js`. The Worker bundles the same renderer core as the browser (`build/anytars-core.mjs`) to validate traits and return an avatar code.

Photos are resized and re-encoded in the browser (removing EXIF data), sent once, analysed and discarded. The Worker never stores or logs request bodies, observability logging is off, and Workers AI lists Clef as zero data retention. A per-IP rate limit protects the AI endpoints.

## Develop and deploy

```bash
npm install
```

```bash
npm run build
```

```bash
npm run deploy
```

`npm run build` wraps the lab page into `dist/`. `npm run deploy` builds and publishes the `anytars` Cloudflare Worker: static assets, the `/api/*` routes, a Workers AI binding and a rate limit, on the custom domain configured in `wrangler.jsonc`. Deploying needs `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in the environment.
