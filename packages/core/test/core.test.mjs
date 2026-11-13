import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render, encode, decode, STYLES, VARIANTS, ENUMS, TUNE, EYE_RENDER, CHEEKS } from '../dist/anytars.mjs';

// Codes created by earlier versions must keep decoding to the same avatar (append-only format).
const FIXTURES = [
  // first public cap + half glasses code (before eye render, accents, cheeks existed)
  ['v1.AQEFAwABAQEBAgAFAQIAAP8AAP8AAAEAACZrQSjUz8g6IhQ6IhTHmiv___8va9gtfW7z0nrUz8jUz8g',
    { face: 'round', 'hair.top': 'afroTop', 'hair.back': 'afro', 'glasses.type': 'half', 'headwear.type': 'baseballCap', skin: '#6b4128' }],
  // elf cap, long beard, beard length slider
  ['v1.AQcJAQABBAIAAgYAAwD-AAAAAAEAAAIAAQDQonorHRZMhslMhskAAAAAAADow1otfW7yxtQrHRYrHRYA_gD_AAAAAAAAAAA',
    { face: 'triangle', 'hair.back': 'long', facialHair: 'long', 'headwear.type': 'elfCap', 'beard.length': -1 }],
];
const get = (o, k) => k.split('.').reduce((a, p) => a?.[p], o);

function mulberry32(a){ return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const HEX = ['#1d1a1f', '#cfac72', '#e2ad84', '#4c86c9', '#d6246e', '#f0ede6'];
function randomTraits(seed){
  const r = mulberry32(seed), pick = a => a[Math.floor(r() * a.length)];
  const t = {
    skin: pick(HEX), face: pick(ENUMS.face), hair: { top: pick(ENUMS.hairTop), back: pick(ENUMS.hairBack), color: pick(HEX) },
    eyes: { shape: pick(ENUMS.eyeShape), left: pick(HEX), right: pick(HEX), lashes: pick(ENUMS.lashes), render: pick(EYE_RENDER) },
    brows: { type: pick(ENUMS.brows) }, nose: { type: pick(ENUMS.nose) }, mouth: { width: pick(ENUMS.mouthWidth), lips: pick(ENUMS.lips) },
    facialHair: pick(ENUMS.facialHair), details: ['freckles', 'mole'].filter(() => r() < .5),
    glasses: { type: pick(ENUMS.glasses), frame: pick(HEX), lens: pick(HEX), lensAlpha: .4 },
    headwear: { type: pick(ENUMS.headwear), color: pick(HEX), accent: pick(HEX) },
    cheeks: { amount: pick(CHEEKS.slice(1)) }, shirt: pick(HEX), bg: pick(HEX),
  };
  t.hair.accent = pick(HEX);
  for (const x of TUNE) { const v = Math.floor(r() * (x.max - x.min + 1)) + x.min; if (v) x.key.split('.').reduce((a, p, i, arr) => i === arr.length - 1 ? (a[p] = v) : (a[p] ??= {}), t); }
  return t;
}

test('old codes still decode to the same avatar', () => {
  for (const [code, expect] of FIXTURES) {
    const t = decode(code);
    for (const [k, v] of Object.entries(expect)) assert.equal(get(t, k), v, `${k} in ${code.slice(0, 16)}…`);
    assert.equal(encode(t).slice(0, code.length), code, 're-encoding keeps the original bytes as a prefix');
  }
});

// Enum indices are stored in codes, so existing values must keep their position (append-only).
test('enum order is append-only', () => {
  const PREFIX = {
    hairTop: ['none','short','undercut','fringe','centerPart','afroTop','buzz','curly','afroCurly','sidePart','receding'],
    hairBack: ['none','long','bob','afro','longWavy'],
  };
  for (const [k, list] of Object.entries(PREFIX)) assert.deepEqual(ENUMS[k].slice(0, list.length), list, k);
});

test('encode/decode round-trips random avatars', () => {
  for (let i = 0; i < 300; i++) {
    const code = encode(randomTraits(i));
    assert.match(code, /^v1\.[A-Za-z0-9_-]+$/);
    assert.equal(encode(decode(code)), code);
  }
});

test('every style x variant renders valid SVG', () => {
  for (let i = 0; i < 60; i++) {
    const t = randomTraits(1000 + i);
    for (const style of Object.keys(STYLES)) for (const v of VARIANTS) {
      const svg = render(t, v, style);
      assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'));
      assert.doesNotMatch(svg, /NaN|undefined|Infinity|\[object/, `${style} ${JSON.stringify(v)}`);
      const ids = [...svg.matchAll(/ id="([^"]+)"/g)].map(m => m[1]);
      assert.equal(new Set(ids).size, ids.length, 'unique ids');
      for (const m of svg.matchAll(/url\(#([^)]+)\)/g)) assert.ok(ids.includes(m[1]), `dangling url(#${m[1]})`);
    }
  }
});

test('ids are unique across renders on one page', () => {
  const t = randomTraits(7);
  const a = render(t), b = render(t);
  const ida = new Set([...a.matchAll(/ id="([^"]+)"/g)].map(m => m[1]));
  for (const m of b.matchAll(/ id="([^"]+)"/g)) assert.ok(!ida.has(m[1]));
});

test('background options', () => {
  const t = { ...randomTraits(3), bg: '#abcdef' };
  assert.ok(render(t, {}, 'cel').includes('#abcdef'));
  const none = render(t, {}, 'cel', { background: 'none', backgroundShape: 'none' });
  assert.ok(!none.includes(t.bg));
  const fixed = render(t, {}, 'flat', { background: '#123456', backgroundShape: 'full' });
  assert.ok(fixed.includes('#123456'));
});
