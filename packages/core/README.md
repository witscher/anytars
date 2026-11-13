# anytars

SVG avatars for humans in their diversity. One person, many versions: 18 expressions (from happy and crying to wink, shrug and upside down), zombie and festive transforms, five art styles, and a short code that holds the whole avatar.

No dependencies. Runs in browsers, Node 18+ and Cloudflare Workers.

> Status: 0.x. The avatar code format is stable and append-only (see `CODE-FORMAT.md`); the JavaScript API may still change before 1.0.

## Use

```js
import { render, decode } from 'anytars';

const person = decode('v1.AQEFAwABAQEBAgAFAQIAAP8AAP8AAAEAACZrQSjUz8g6IhQ6IhTHmiv___8va9gtfW7z0nrUz8jUz8g');

render(person);                                      // neutral, chibi style
render(person, { expression: 'laughing' }, 'cel');   // another mood, another style
render(person, { transform: 'zombie' }, 'anime');    // same person, as a zombie
render(person, { expression: 'wink' }, 'sticker', { background: 'none' });
```

`render` returns an SVG string with `viewBox="0 0 200 200"`. Put it in the DOM, write it to a file, or return it from a Worker with `content-type: image/svg+xml`.

In a page without a bundler, load the global build and use `render`, `encode` and `decode` directly:

```html
<script src="https://cdn.jsdelivr.net/npm/anytars@0.1.0/dist/anytars.global.js"></script>
```

## Traits

A person is a plain object (`Traits` in `index.d.ts`): skin, face shape, hair (top, back, colour, accent), eyes (shape, two colours, lashes, drawing style), brows, nose, mouth, facial hair, details (freckles, wrinkles, mole, vitiligo), glasses, headwear, cheeks, top and background colours. Allowed values are exported as `ENUMS`. Fine-tuning sliders (eye spacing, height, size, tilt; brows; nose; mouth; glasses height; beard thickness and length) are small integers, listed in `TUNE`.

```js
import { encode } from 'anytars';
const code = encode(person);   // 'v1.…' - store it, put it in a URL, render it anywhere
```

## Options

| Option | Values |
|---|---|
| `background` | `'avatar'` (default, the avatar's colour), a hex colour, `'none'` (transparent) |
| `backgroundShape` | `'style'` (default), `'circle'`, `'rounded'`, `'full'`, `'none'` |
| `eyeMode` | override the eye drawing: `'detailed'`, `'bean'`, `'flatIris'`, `'dot'`, `'beanLid'`, `'button'` |

Set them per call, or for every call through `ANYTARS_CONFIG`.

## Styles, expressions, transforms

- Styles: `chibi`, `cel`, `flat`, `anime`, `sticker`
- Expressions: `EXPRESSIONS`
- Transforms: `zombie`, `festive`
