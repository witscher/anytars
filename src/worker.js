// anytars Worker: static site + Workers AI endpoints.
//
//   POST /api/edit   { text, traits }  -> Clef flash decides which traits the request changes
//   POST /api/photo  { image }         -> Clef omni decides traits from a photo
//
// Clef models are decision models: they take a `state` and typed `questions` (choice / noul / score)
// and return a probability for every allowed answer. Every avatar trait maps to one question, so a
// single call fills the whole avatar, and the result can only ever contain valid trait values.
//
// Privacy: photos exist only inside the request. They are never written to storage, cache or logs,
// and the Clef models are listed by Workers AI as zero data retention.

import { ENUMS, TUNE, getK, setK, encode } from '../build/anytars-core.mjs';
import * as V from './vocab.js';

const FLASH = '@cf/cloudflare/clef-flash';
const OMNI = '@cf/cloudflare/clef-omni';
const MAX_TEXT = 400;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;   // after base64 decoding; the browser sends ~150 KB

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405);
    if (env.AI_LIMIT) {
      const { success } = await env.AI_LIMIT.limit({ key: request.headers.get('cf-connecting-ip') || 'anon' });
      if (!success) return json({ error: 'Too many requests. Try again in a minute.' }, 429);
    }
    try {
      const body = await request.json();
      if (url.pathname === '/api/edit') return json(await edit(env, body));
      if (url.pathname === '/api/photo') return json(await photo(env, body));
      return json({ error: 'Not found.' }, 404);
    } catch (e) {
      // Never echo or log the request body (it may contain a photo).
      return json({ error: e.expose ? e.message : 'The AI request failed. Try again.' }, e.status || 500);
    }
  },
};

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
});
const fail = (message, status = 400) => Object.assign(new Error(message), { expose: true, status });

// ---------- question builders ----------
const desc = map => Object.fromEntries(Object.entries(map).map(([k, v]) => [k, Array.isArray(v) ? v.at(-1) : v]));
const withKeep = (map, what) => ({ keep: `the request does not ask to change the ${what}`, ...desc(map) });
const choice = (instructions, criteria) => ({ type: 'choice', instructions, criteria });

// Trait questions shared by both flows: [id, label, options map, apply(traits, answer)]
const TRAITS = [
  ['face', 'face shape', V.FACE, (t, v) => { t.face = v; }],
  ['hairTop', 'hairstyle on top', V.HAIR_TOP, (t, v) => { t.hair.top = v; }],
  ['hairBack', 'hair length', V.HAIR_BACK, (t, v) => { t.hair.back = v; }],
  ['hairColor', 'hair colour', V.HAIR_COLOR, (t, v) => { t.hair.color = V.HAIR_COLOR[v][0]; delete t.brows.color; }],
  ['hairAccent', 'hair highlights or accent colour', { none: ['', 'no highlights, accent follows the hair colour'], ...Object.fromEntries(Object.entries(V.HAIR_COLOR).map(([k, [h, d]]) => [k, [h, d.replace(' hair', '') + ' highlights or streaks']])) },
    (t, v) => { if (v === 'none') delete t.hair.accent; else t.hair.accent = V.HAIR_COLOR[v][0]; }, 'edit'],
  ['eyeShape', 'eye shape', V.EYE_SHAPE, (t, v) => { t.eyes.shape = v; }],
  ['eyeColor', 'eye colour', V.EYE_COLOR, (t, v) => { t.eyes.left = t.eyes.right = V.EYE_COLOR[v][0]; }],
  ['lashes', 'eyelashes', V.LASHES, (t, v) => { t.eyes.lashes = v; }],
  ['brows', 'eyebrows', V.BROWS, (t, v) => { t.brows.type = v; }],
  ['nose', 'nose', V.NOSE, (t, v) => { t.nose.type = v; }],
  ['mouthWidth', 'mouth width', V.MOUTH_WIDTH, (t, v) => { t.mouth.width = v; }],
  ['lips', 'lips', V.LIPS, (t, v) => { t.mouth.lips = v; }],
  ['facialHair', 'facial hair', V.FACIAL_HAIR, (t, v) => { t.facialHair = v; }],
  ['beardColor', 'beard colour', V.HAIR_COLOR, (t, v) => { t.facialHairColor = V.HAIR_COLOR[v][0]; }],
  ['glasses', 'glasses', V.GLASSES, (t, v) => { t.glasses = v === 'none' ? { type: 'none' } : { frame: '#16161a', lens: '#ffffff', lensAlpha: .12, ...t.glasses, type: v }; }],
  ['lens', 'glasses lenses', V.LENS, (t, v) => { if (t.glasses?.type && t.glasses.type !== 'none') { t.glasses.lens = V.LENS[v][0]; t.glasses.lensAlpha = V.LENS[v][1]; } }],
  ['frameColor', 'glasses frame colour', V.FRAME_COLOR, (t, v) => { if (t.glasses?.type && t.glasses.type !== 'none') t.glasses.frame = V.FRAME_COLOR[v][0]; }],
  ['headwear', 'headwear', V.HEADWEAR, (t, v) => { t.headwear = { color: '#2f6bd8', ...t.headwear, type: v }; }],
  ['headwearColor', 'headwear colour', V.CLOTH, (t, v) => { t.headwear = { ...t.headwear, color: V.CLOTH[v][0] }; }],
  ['headwearAccent', 'second colour of the headwear (band, spots, pom-pom, logo)', V.CLOTH, (t, v) => { t.headwear = { ...t.headwear, accent: V.CLOTH[v][0] }; }, 'edit'],
  ['shirt', 'top (clothing) colour', V.CLOTH, (t, v) => { t.shirt = V.CLOTH[v][0]; }],
];

function describe(t) {
  const name = (map, v) => { const e = Object.entries(map).find(([k, x]) => k === v || (Array.isArray(x) && x[0] === v)); return e ? (Array.isArray(e[1]) ? e[1].at(-1) : e[1]) : v; };
  return {
    face: name(V.FACE, t.face), hair: `${name(V.HAIR_TOP, t.hair.top)}; ${name(V.HAIR_BACK, t.hair.back)}; ${name(V.HAIR_COLOR, t.hair.color)}`,
    eyes: `${name(V.EYE_SHAPE, t.eyes.shape)}, ${name(V.EYE_COLOR, t.eyes.left)}, ${name(V.LASHES, t.eyes.lashes || 'none')}`,
    eyebrows: name(V.BROWS, t.brows.type), nose: name(V.NOSE, t.nose.type), mouth: `${name(V.MOUTH_WIDTH, t.mouth.width)}, ${name(V.LIPS, t.mouth.lips)}`,
    facialHair: name(V.FACIAL_HAIR, t.facialHair || 'none'),
    glasses: t.glasses?.type && t.glasses.type !== 'none' ? `${name(V.GLASSES, t.glasses.type)}, ${name(V.FRAME_COLOR, t.glasses.frame)}` : 'no glasses',
    headwear: name(V.HEADWEAR, t.headwear?.type || 'none'), details: (t.details || []).map(d => V.DETAILS[d]).join(', ') || 'none',
    top: name(V.CLOTH, t.shirt) + ' top', background: name(V.BG, t.bg) + ' background',
  };
}

function sanitize(t) {
  // Accept only known trait values; anything else falls back to a safe default.
  const pick = (list, v, d) => list.includes(v) ? v : d;
  const hex = (v, d) => /^#[0-9a-f]{6}$/i.test(v || '') ? v : d;
  const g = t?.glasses || {};
  const out = {
    skin: hex(t?.skin, '#e2ad84'), face: pick(ENUMS.face, t?.face, 'oval'),
    hair: { top: pick(ENUMS.hairTop, t?.hair?.top, 'short'), back: pick(ENUMS.hairBack, t?.hair?.back, 'none'), color: hex(t?.hair?.color, '#4a3222') },
    eyes: { shape: pick(ENUMS.eyeShape, t?.eyes?.shape, 'round'), left: hex(t?.eyes?.left, '#5b3b22'), right: hex(t?.eyes?.right, '#5b3b22'), lashes: pick(ENUMS.lashes, t?.eyes?.lashes, 'none') },
    brows: { type: pick(ENUMS.brows, t?.brows?.type, 'medium') }, nose: { type: pick(ENUMS.nose, t?.nose?.type, 'straight') },
    mouth: { width: pick(ENUMS.mouthWidth, t?.mouth?.width, 'medium'), lips: pick(ENUMS.lips, t?.mouth?.lips, 'medium') },
    facialHair: pick(ENUMS.facialHair, t?.facialHair, 'none'),
    details: (Array.isArray(t?.details) ? t.details : []).filter(d => d in V.DETAILS),
    glasses: g.type && ENUMS.glasses.includes(g.type) && g.type !== 'none' ? { type: g.type, frame: hex(g.frame, '#16161a'), lens: hex(g.lens, '#ffffff'), lensAlpha: Math.min(1, Math.max(0, +g.lensAlpha || 0)) } : { type: 'none' },
    headwear: { type: pick(ENUMS.headwear, t?.headwear?.type, 'none'), color: hex(t?.headwear?.color, '#2f6bd8') },
    shirt: hex(t?.shirt, '#3d5a80'), bg: hex(t?.bg, '#cfe0ee'),
  };
  if (t?.eyes?.render && V.EYE_RENDER[t.eyes.render]) out.eyes.render = t.eyes.render;
  if (t?.brows?.color) out.brows.color = hex(t.brows.color);
  if (t?.facialHairColor) out.facialHairColor = hex(t.facialHairColor);
  if (t?.hair?.accent) out.hair.accent = hex(t.hair.accent);
  if (t?.headwear?.accent) out.headwear.accent = hex(t.headwear.accent);
  TUNE.forEach(x => { const v = Math.round(+getK(t || {}, x.key) || 0); if (v) setK(out, x.key, Math.max(x.min, Math.min(x.max, v))); });
  return out;
}

const r2 = v => Math.round((v ?? 0) * 100) / 100;
const report = (id, label, a) => ({ id, label, choice: a.choice, confidence: r2(a.probabilities?.[a.choice] ?? a.confidence), ...(a.probabilities && 'keep' in a.probabilities ? { keep: r2(a.probabilities.keep) } : {}) });

// ---------- text edits (Clef flash) ----------
async function edit(env, body) {
  const text = String(body?.text || '').trim().slice(0, MAX_TEXT);
  if (!text) throw fail('Describe what to change.');
  const t = sanitize(body?.traits);
  const ask = 'Apply the request to the current avatar. Which option should the avatar have afterwards? Choose keep unless the request asks for a change to this part.';
  const questions = {};
  TRAITS.forEach(([id, label, map]) => { questions[id] = choice(`${ask} Part: ${label}.`, withKeep(map, label)); });
  questions.skin = choice(`${ask} Part: skin tone.`, { keep: 'the request does not ask to change the skin tone', darker: 'a darker skin tone than now', lighter: 'a lighter skin tone than now', ...Object.fromEntries(V.SKIN_LEVELS.map(([hexv, d], i) => ['s' + i, d + ' skin'])) });
  questions.bg = choice(`${ask} Part: background colour.`, withKeep(V.BG, 'background colour'));
  Object.entries(V.DETAILS).forEach(([k, d]) => { questions['detail_' + k] = choice(`Does the request explicitly ask to add or remove ${d}, or ask for something that clearly implies it (for example older or younger for wrinkles)? Choose keep if ${d} is not asked for.`, { keep: `the request does not ask about ${d}`, add: `add ${d}`, remove: `remove ${d}` }); });
  V.SLIDERS.forEach(([key, label, more, less]) => { questions['slider_' + key.replace('.', '_')] = choice(`${ask} Part: ${label}.`, { keep: `the request does not ask to change the ${label}`, more, less }); });
  questions.expression = choice('Which version of the avatar does the request ask to see: an expression (neutral, happy, laughing, sincere, sad, crying, surprised, angry) or a transformation (zombie, festive party)? Choose keep if it asks for neither.', withKeep(V.EXPRESSION, 'expression or transformation'));
  questions.style = choice('Does the request ask for a different drawing style? Choose keep if not.', withKeep(V.STYLE, 'drawing style'));
  questions.eyeRender = choice('Does the request ask for a different way of drawing the eyes? Choose keep if not.', withKeep(V.EYE_RENDER, 'eye drawing style'));

  const started = Date.now();
  const res = await env.AI.run(FLASH, { model: 'clef-flash', state: { request: text, current_avatar: describe(t) }, questions });
  const ms = Date.now() - started;
  const A = res.answers || {};
  // Clef returns a probability for every option, including "keep". A part changes only when the model is
  // clearly confident the request is about it: keep below 20% and the chosen value at least 35%.
  const decided = (id) => { const a = A[id]; if (!a || a.choice === 'keep') return null; const p = a.probabilities?.[a.choice] ?? 0; return p >= 0.35 && (a.probabilities?.keep ?? 0) < 0.2 ? a.choice : null; };
  const changed = (fn) => { const before = encode(t); fn(); return encode(t) !== before; };   // codes ignore key order

  const changes = [];
  TRAITS.forEach(([id, label, map, apply]) => { const v = decided(id); if (v && changed(() => apply(t, v))) changes.push(report(id, label, A[id])); });
  const sk = decided('skin');
  if (sk && changed(() => {
    if (sk === 'darker' || sk === 'lighter'){   // relative: two steps from the nearest palette level
      const dist = h => { const p = x => [1,3,5].map(i => parseInt(x.slice(i, i+2), 16)); const a = p(h), b = p(t.skin); return a.reduce((s, v, i) => s + (v-b[i])**2, 0); };
      const cur = V.SKIN_LEVELS.reduce((best, [h], i) => dist(h) < dist(V.SKIN_LEVELS[best][0]) ? i : best, 0);
      t.skin = V.SKIN_LEVELS[Math.max(0, Math.min(V.SKIN_LEVELS.length - 1, cur + (sk === 'darker' ? 2 : -2)))][0];
    } else t.skin = V.SKIN_LEVELS[+sk.slice(1)][0];
  })) changes.push(report('skin', 'skin tone', A.skin));
  const bg = decided('bg'); if (bg && changed(() => { t.bg = V.BG[bg][0]; })) changes.push(report('bg', 'background', A.bg));
  Object.keys(V.DETAILS).forEach(k => { const v = decided('detail_' + k); if (!v) return;
    t.details = v === 'add' ? [...new Set([...t.details, k])] : t.details.filter(d => d !== k); changes.push(report('detail_' + k, V.DETAILS[k], A['detail_' + k])); });
  V.SLIDERS.forEach(([key, label]) => { const id = 'slider_' + key.replace('.', '_'), v = decided(id); if (!v) return;
    const x = TUNE.find(s => s.key === key), cur = +getK(t, key) || 0, step = v === 'more' ? 2 : -2;
    setK(t, key, Math.max(x.min, Math.min(x.max, cur + step))); changes.push(report(id, label, A[id])); });
  const er = decided('eyeRender'); if (er) { if (er === 'auto') delete t.eyes.render; else t.eyes.render = er; changes.push(report('eyeRender', 'eye drawing', A.eyeRender)); }
  const expression = decided('expression'), style = decided('style');
  if (expression) changes.push(report('expression', 'expression', A.expression));
  if (style) changes.push(report('style', 'style', A.style));

  return { model: FLASH, ms, usage: res.usage, questions: Object.keys(questions).length, changes, traits: t, code: encode(t), expression, style };
}

// ---------- photo to avatar (Clef omni) ----------
async function photo(env, body) {
  const image = String(body?.image || '');
  const m = image.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (!m) throw fail('Send a JPEG, PNG or WebP image.');
  if (m[2].length * 0.75 > MAX_IMAGE_BYTES) throw fail('That image is too large. Try a smaller photo.');
  const base = sanitize(body?.traits || {});

  const ask = 'Look at the person in the photo and pick the option that best matches for a friendly cartoon avatar.';
  const questions = {};
  TRAITS.forEach(([id, label, map, , only]) => {
    if (id === 'headwearColor' || id === 'frameColor' || id === 'lens' || only === 'edit') return;
    questions[id] = choice(`${ask} Part: ${label}.`, desc(map));
  });
  questions.frameColor = choice(`${ask} Part: glasses frame colour (if no glasses, pick any).`, desc(V.FRAME_COLOR));
  questions.lens = choice(`${ask} Part: glasses lenses (if no glasses, pick clear).`, desc(V.LENS));
  questions.headwearColor = choice(`${ask} Part: colour of the headwear (if none, pick any).`, desc(V.CLOTH));
  questions.skin = { type: 'score', instructions: `${ask} Part: skin tone.`, criteria: V.SKIN_LEVELS.map(([, d]) => d + ' skin') };
  questions.freckles = { type: 'noul', instructions: 'Does the person have visible freckles?' };
  questions.wrinkles = { type: 'noul', instructions: 'Does the person have visible wrinkles or deep smile lines?' };
  questions.smiling = { type: 'noul', instructions: 'Is the person smiling?' };
  questions.isPerson = { type: 'noul', instructions: 'Does the image show a real person\'s face clearly enough to describe it?' };

  const started = Date.now();
  const res = await env.AI.run(OMNI, { model: 'clef-omni', state: 'A photo uploaded to create a cartoon avatar of the person in it.', images: [image], questions });
  const ms = Date.now() - started;
  const A = res.answers || {};
  if ((A.isPerson?.noul ?? 1) < 0.35) throw fail('No face found in that photo. Try a clear, front-facing picture.', 422);

  const t = { ...base, details: [] };
  const decisions = [];
  TRAITS.forEach(([id, label, map, apply, only]) => { if (only === 'edit') return; const a = A[id]; if (a?.choice && a.choice in map) { apply(t, a.choice); decisions.push(report(id, label, a)); } });
  // Colour and lens answers only matter when the part is present.
  const hide = new Set([...(t.glasses.type === 'none' ? ['lens', 'frameColor'] : []), ...(t.headwear.type === 'none' ? ['headwearColor'] : [])]);
  for (let k = decisions.length - 1; k >= 0; k--) if (hide.has(decisions[k].id)) decisions.splice(k, 1);
  if (typeof A.skin?.score === 'number') {
    const s = Math.max(0, Math.min(V.SKIN_LEVELS.length - 1, A.skin.score)), i = Math.floor(s), f = s - i;
    t.skin = blend(V.SKIN_LEVELS[i][0], V.SKIN_LEVELS[Math.min(i + 1, V.SKIN_LEVELS.length - 1)][0], f);
    decisions.push({ id: 'skin', label: 'skin tone', choice: `level ${Math.round(s * 10) / 10} of ${V.SKIN_LEVELS.length - 1}`, confidence: Math.round((A.skin.confidence ?? 0) * 100) / 100 });
  }
  if ((A.freckles?.noul ?? 0) > 0.6) t.details.push('freckles');
  if ((A.wrinkles?.noul ?? 0) > 0.6) t.details.push('wrinkles');
  ['freckles', 'wrinkles', 'smiling'].forEach(k => decisions.push({ id: k, label: k, choice: (A[k]?.noul ?? 0) > 0.5 ? 'yes' : 'no', confidence: Math.round(Math.max(A[k]?.noul ?? 0, 1 - (A[k]?.noul ?? 0)) * 100) / 100 }));
  // Tuning sliders start neutral for a fresh avatar.
  TUNE.forEach(x => { if (getK(t, x.key)) setK(t, x.key, 0); });

  return { model: OMNI, ms, usage: res.usage, questions: Object.keys(questions).length, decisions, traits: t, code: encode(t), expression: (A.smiling?.noul ?? 0) > 0.6 ? 'happy' : 'neutral' };
}

function blend(a, b, f) {
  const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const A = p(a), B = p(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * f).toString(16).padStart(2, '0')).join('');
}
