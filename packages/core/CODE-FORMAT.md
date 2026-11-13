# Avatar code format (v1)

An avatar code is the complete avatar in a short, URL-safe string, e.g.

```
v1.AQEFAwABAQEBAgAFAQIAAP8AAP8AAAEAACZrQSjUz8g6IhQ6IhTHmiv___8va9gtfW7z0nrUz8jUz8g
```

`v1.` followed by a byte array in base64url (no padding). Codes are shared in links and stored by apps, so the format is a public contract. `decode(encode(t))` returns the same avatar.

## Rules

1. **Append only.** New fields are added at the end. Existing fields never move, change meaning or change size.
2. **Enums are append only.** New values for a list (hairstyles, hats, glasses, …) go at the end of that list, so stored indices keep pointing at the same value.
3. **Missing trailing fields mean the default.** A decoder reads optional fields only while bytes remain, so codes made before a field existed still decode.
4. **Unknown trailing bytes are ignored**, so an older decoder can read a newer code (it simply misses the new fields).
5. A change that cannot follow these rules starts `v2.`; decoders keep supporting `v1.`.

Removing a value from an enum is not allowed. A retired part keeps its index and is drawn as its closest replacement.

## Layout

| Bytes | Field |
|---|---|
| 1 | format byte, `1` |
| 12 | enum indices: face, hair top, hair back, eye shape, lashes, brows, nose, mouth width, lips, facial hair, glasses, headwear |
| 1 | details bitmask: freckles 1, wrinkles 2, mole 4, vitiligo 8 |
| 11 | tuning sliders as signed bytes, in this order: eyes spacing, eyes y, eyes size, eyes tilt, brows spacing, brows y, brows tilt, nose y, nose size, mouth y, mouth size |
| 1 | lens alpha, 0–255 |
| 33 | 11 colours as RGB: skin, hair, left eye, right eye, glasses frame, lens, headwear, top, background, brows, facial hair |
| 1 | eye render: auto, detailed, bean, flatIris, dot, beanLid, button |
| 3 | sliders added later (signed): glasses y, beard thickness, beard length |
| 4 | hair accent colour: present flag, R, G, B |
| 4 | headwear accent colour: present flag, R, G, B |
| 1 | cheeks amount: auto, none, light, medium, strong |
| 4 | cheeks colour: present flag, R, G, B |

The enum lists themselves are exported as `ENUMS` (and `EYE_RENDER`, `CHEEKS`). Their order is part of the format.

What is not in the code: the style, the expression or transform, the background settings and the avatar's name. Those are choices of the app showing the avatar, not of the person.
