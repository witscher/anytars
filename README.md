# anytars

SVG avatars for humans in their diversity. One person, many versions: 18 expressions (happy, crying, wink, shrug, upside down, …), zombie and festive transforms, five art styles, and a short code that holds the whole avatar.

- **Try it:** https://anytars.davebuilds.net. The avatar maker: describe a character, start from a photo, or edit every part.
- **Library:** [`anytars` on npm](https://www.npmjs.com/package/anytars). No dependencies, runs in browsers, Node and Cloudflare Workers.
- **Style lab:** https://anytars.davebuilds.net/lab/

A personal project that showcases Cloudflare technology (Workers, static assets, Workers AI). It is not a Cloudflare product.

```js
import { render, decode } from 'anytars';

const person = decode('v1.AQEFAwABAQEBAgAFAQIAAP8AAP8AAAEAACZrQSjUz8g6IhQ6IhTHmiv___8va9gtfW7z0nrUz8jUz8g');
render(person, { expression: 'laughing' }, 'cel');   // SVG string
```

See [`packages/core/README.md`](packages/core/README.md) for the library API.

## Contributing

Contributions from people and coding agents are welcome. The project is set up so an agent can work on it end to end:

- **Instructions:** [`AGENTS.md`](AGENTS.md) has the layout, the commands and the rules that must not be broken, such as the append-only avatar code and identity staying fixed across expressions. It also has step-by-step recipes for adding a hat, hairstyle, expression or trait. [`CLAUDE.md`](CLAUDE.md) adds a few notes for Claude.
- **Fast feedback:** `npm test` checks the library in seconds. Old avatar codes must still decode, and every style and version must render valid SVG.
- **Visual QA:** `npm run qa` renders 2,000 random avatars in every style and version (about 360,000 SVGs). It pixel-checks each layer for problems such as hair over the eyes, glasses off the eyes, skin past a beard, a mouth outside the face or hats cut off at the edge. The baseline is 0 errors and about 10 reviewed edge cases.
- **AI evaluation:** `npm run eval:ai` scores about 1,000 natural-language edits against expected outcomes. It's currently at 98.5%.

Good first contributions:
- new hats, glasses or hairstyles;
- more expressions;
- better hair texture;
- accessibility of the maker;
- a Python package. The code format is specified in [`packages/core/CODE-FORMAT.md`](packages/core/CODE-FORMAT.md).

Please open an issue before large changes to the trait model or the code format.

## Repository layout

| Path | What |
|---|---|
| `packages/core` | The library: renderer, avatar code, types, tests, code format spec. |
| `apps/maker` | The avatar maker: `public/` (page) and `worker/` (Cloudflare Worker with the Workers AI endpoints). |
| `apps/lab` | The style lab. |
| `apps/shared/cast.js` | Example characters for the maker and the lab. |
| `qa/` | Renderer QA and the AI evaluation. |

## How the AI works

The maker runs on Cloudflare Workers AI with **Clef** decision models, which answer typed questions with a probability for every allowed option instead of generating text.

- **Text edits** (`/api/edit`, Clef flash): each avatar trait is a multiple-choice question whose options are exactly the values the renderer can draw, plus "keep". One call answers about 50 questions in a few hundred milliseconds and can only produce valid avatars.
- **Photos** (`/api/photo`, Clef omni): the same questions, answered from an image. Skin tone is a score that can fall between palette steps.
- **Names** (`/api/name`, Clef flash): yes/no checks for profanity, hate, sexual content and violence, on the name as typed and on a decoded spelling, with an allow-list for real names that look rude.

**Privacy:**
- Photos are resized in the browser, which also removes location and camera data.
- They are sent once, analysed and discarded.
- The Worker stores nothing and logs no request bodies.
- Workers AI lists Clef as zero data retention.

## Deploy your own

```bash
npm install
```

```bash
npm run deploy
```

Change the custom domain in `wrangler.jsonc` first, or remove `routes` to use a workers.dev URL. Deploying needs a Cloudflare account with Workers AI. Set `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`, or log in with `npx wrangler login`.

## License

MIT, for the code and the artwork. See [LICENSE](LICENSE).
