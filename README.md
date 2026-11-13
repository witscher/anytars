# anytars

Open-source SVG avatar library for humans in their diversity. Every person has one recognizable base avatar plus versions of it: expressions (happy, sad, crying, ...) and transforms (zombie, festive, ...).

Live style lab: https://anytars.davebuilds.net

## Status

Style exploration. `explorations/style-v1/index.html` holds a prototype renderer (traits JSON + variant + style -> SVG), the cast, Mii-style tuning sliders and a reversible avatar code (`v1.` + base64url).

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

`npm run build` wraps the lab page into `dist/`. `npm run deploy` builds and publishes it as the `anytars` Cloudflare Worker (static assets) on the custom domain configured in `wrangler.jsonc`. Deploying needs `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in the environment.
