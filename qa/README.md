# Avatar QA

Renders thousands of random avatars over the full option space (every enum value and the full slider ranges) and checks them.

- **String checks** on every style x every version: no `NaN`/`undefined` in the SVG, valid XML, unique ids, no dangling `url(#id)` references.
- **Pixel checks** (no background, 128 px): each layer is rasterized on its own via the `data-l` layer tags, then overlaps are measured. Flags include eyes covered by hair or hats, brows under a hat brim, glasses off the eyes, skin showing past a full beard, moustache over the nose, a hat floating above the head, and hair or hats cut off at the canvas edge.

Run (needs Playwright with Chromium):

```bash
npm run qa
```

```bash
node qa/sheet.cjs qa/flagged.png
```

`qa/results.json` lists every flagged avatar with its code, so any case can be reproduced in the maker by pasting the code.
