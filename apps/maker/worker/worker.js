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

import { ENUMS, TUNE, getK, setK, encode } from '../../../packages/core/src/anytars.js';
import * as V from './vocab.js';

const FLASH = '@cf/cloudflare/clef-flash';
const OMNI = '@cf/cloudflare/clef-omni';
const MAX_TEXT = 400;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;   // after base64 decoding; the browser sends ~150 KB

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return withLegalLinks(await env.ASSETS.fetch(request), env);
    if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405);
    if (env.AI_LIMIT) {
      const { success } = await env.AI_LIMIT.limit({ key: request.headers.get('cf-connecting-ip') || 'anon' });
      if (!success) return json({ error: 'Too many requests. Try again in a minute.' }, 429);
    }
    try {
      const body = await request.json();
      if (url.pathname === '/api/edit') return json(await edit(env, body));
      if (url.pathname === '/api/photo') return json(await photo(env, body));
      if (url.pathname === '/api/name') return json(await checkName(env, body));
      return json({ error: 'Not found.' }, 404);
    } catch (e) {
      // Never echo or log the request body (it may contain a photo).
      return json({ error: e.expose ? e.message : 'The AI request failed. Try again.' }, e.status || 500);
    }
  },
};

// Legal links are deployment settings, not source: each operator sets LEGAL_IMPRINT_URL and LEGAL_PRIVACY_URL
// (Worker variables; .dev.vars locally). They are written into every page's [data-legal] slot here, so they
// arrive as plain links in the HTML. Without them the slot is removed, and a fork never points at someone
// else's legal pages.
const LEGAL = [['LEGAL_IMPRINT_URL', 'Legal Notice'], ['LEGAL_PRIVACY_URL', 'Privacy']];
const httpsUrl = v => { try { const u = new URL(v); return u.protocol === 'https:' ? u.href : null; } catch { return null; } };
const attr = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
function withLegalLinks(res, env){
  if (!(res.headers.get('content-type') || '').includes('text/html')) return res;
  const links = LEGAL.map(([k, label]) => { const u = httpsUrl(env[k]); return u ? `<a href="${attr(u)}">${label}</a>` : ''; }).join('');
  return new HTMLRewriter().on('[data-legal]', { element(el){ if (links) el.setInnerContent(links, { html: true }); else el.remove(); } }).transform(res);
}

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
  ['facialHair', 'facial hair', V.FACIAL_HAIR, (t, v) => { if (v === 'any') { if (t.facialHair && t.facialHair !== 'none') return; v = 'full'; } t.facialHair = v; }],
  ['beardColor', 'beard colour', V.HAIR_COLOR, (t, v) => { t.facialHairColor = V.HAIR_COLOR[v][0]; }],
  ['glasses', 'glasses', V.GLASSES, (t, v) => {
    if (v === 'any') { if (t.glasses?.type && t.glasses.type !== 'none') return; v = ['rect', 'round', 'softSquare', 'panto'][Math.floor(Math.random() * 4)]; }
    t.glasses = v === 'none' ? { type: 'none' } : { frame: '#16161a', lens: '#ffffff', lensAlpha: .12, ...t.glasses, type: v }; }],
  ['lens', 'glasses lenses', V.LENS, (t, v) => {
    if (!t.glasses?.type || t.glasses.type === 'none') { if (v === 'clear') return; t.glasses = { type: 'wayfarer', frame: '#16161a' }; }   // "sunglasses" on a bare face
    t.glasses.lens = V.LENS[v][0]; t.glasses.lensAlpha = V.LENS[v][1]; }],
  ['frameColor', 'glasses frame colour', V.FRAME_COLOR, (t, v) => {
    if (!t.glasses?.type || t.glasses.type === 'none') t.glasses = { type: 'rect', lens: '#ffffff', lensAlpha: .12 };   // "gold frames" on a bare face
    t.glasses.frame = V.FRAME_COLOR[v][0]; }],
  ['headwear', 'headwear', V.HEADWEAR, (t, v) => { t.headwear = { color: '#2f6bd8', ...t.headwear, type: v }; }],
  ['headwearColor', 'headwear colour', V.CLOTH, (t, v) => { t.headwear = { ...t.headwear, color: V.CLOTH[v][0] }; }],
  ['headwearAccent', 'second colour of the headwear (band, spots, pom-pom, logo)', V.CLOTH, (t, v) => { t.headwear = { ...t.headwear, accent: V.CLOTH[v][0] }; }, 'edit'],
  ['shirt', 'top (clothing) colour', V.CLOTH, (t, v) => { t.shirt = V.CLOTH[v][0]; }],
  ['cheeks', 'blush on the cheeks', V.CHEEKS, (t, v) => { t.cheeks = { ...t.cheeks, amount: v }; }, 'edit'],
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
  if (t?.cheeks && typeof t.cheeks === 'object'){ const c = {}; if (['none','light','medium','strong'].includes(t.cheeks.amount)) c.amount = t.cheeks.amount; if (t.cheeks.color) c.color = hex(t.cheeks.color); if (Object.keys(c).length) out.cheeks = c; }
  TUNE.forEach(x => { const v = Math.round(+getK(t || {}, x.key) || 0); if (v) setK(out, x.key, Math.max(x.min, Math.min(x.max, v))); });
  return out;
}

const r2 = v => Math.round((v ?? 0) * 100) / 100;
const MENTION = [['face', 'face shape'], ['hairTop', 'hairstyle, haircut or baldness (for example a buzz cut, bangs, curls, a parting, a mohawk, a pixie cut, cornrows, bald)'], ['hairBack', 'hair length or tied-up hair (for example long hair, a bob, short hair, an afro, a ponytail, a bun or top knot, pigtails, braids, dreadlocks)'], ['eyeShape', 'eye shape'], ['lashes', 'eyelashes'],
  ['brows', 'eyebrows'], ['nose', 'nose'], ['mouthWidth', 'mouth width or size'], ['lips', 'lips'], ['facialHair', 'beard or moustache'],
  ['glasses', 'glasses or sunglasses'], ['headwear', 'hat, headscarf or other headwear'], ['skin', 'skin tone']];
const MENTION_IDS = new Set(MENTION.map(m => m[0]));
const report = (id, label, a) => ({ id, label, choice: a.choice, confidence: r2(a.probabilities?.[a.choice] ?? a.confidence), ...(a.probabilities && 'keep' in a.probabilities ? { keep: r2(a.probabilities.keep) } : {}) });

// ---------- text edits (Clef flash) ----------
async function edit(env, body) {
  const text = String(body?.text || '').trim().slice(0, MAX_TEXT);
  if (!text) throw fail('Describe what to change.');
  let t = sanitize(body?.traits);
  const ask = 'Apply the request to the avatar. Which option should the avatar have afterwards? Choose keep unless the request names this part or directly describes how it should look. Expressions, moods, age, transformations (zombie, party) and drawing styles are handled by other questions and never change this part on their own.';
  const questions = {};
  TRAITS.forEach(([id, label, map]) => { questions[id] = choice(`${ask} Part: ${label}.`, withKeep(id === 'glasses' ? { ...map, any: 'glasses, when the request asks for glasses without naming a type' } : id === 'facialHair' ? { ...map, any: 'a beard, when the request asks for a beard without naming a style' } : map, label)); });
  questions.skin = choice(`${ask} Part: skin tone.`, { keep: 'the request does not ask to change the skin tone', darker: 'a darker skin tone than now', lighter: 'a lighter skin tone than now', ...Object.fromEntries(V.SKIN_LEVELS.map(([hexv, d], i) => ['s' + i, d + ' skin'])) });
  questions.bg = choice(`${ask} Part: background colour.`, withKeep(V.BG, 'background colour'));
  Object.entries(V.DETAILS).forEach(([k, d]) => { questions['detail_' + k] = choice(`Does the request explicitly ask to add or remove ${d}, or ask for something that clearly implies it (for example older or younger for wrinkles)? Choose keep if ${d} is not asked for.`, { keep: `the request does not ask about ${d}`, add: `add ${d}`, remove: `remove ${d}` }); });
  V.SLIDERS.forEach(([key, label, more, less]) => { questions['slider_' + key.replace('.', '_')] = choice(`Does the request explicitly ask for ${more} or ${less}? Choose keep unless the size, length or position itself is asked for; naming a colour or style is not enough.`, { keep: `the request does not ask to change the ${label}`, more, less }); });
  questions.expression = choice('Which version of the avatar does the request ask to see: an expression (neutral, happy, laughing, sincere, sad, crying, surprised, angry) or a transformation (zombie, festive party)? Choose keep if it asks for neither.', withKeep(V.EXPRESSION, 'expression or transformation'));
  questions.style = choice('Does the request ask for a different drawing style? Choose keep if not.', withKeep(V.STYLE, 'drawing style'));
  questions.eyeRender = choice('Does the request ask for a different way of drawing the eyes? Choose keep if not.', withKeep(V.EYE_RENDER, 'eye drawing style'));
  // Mention checks: a yes/no question per shape-type part. A part only changes when the request itself names or
  // describes it, so moods, age, styles and transformations can't leak into eye shape, mouth width and so on.
  MENTION.forEach(([id, label]) => { questions['m_' + id] = { type: 'noul', instructions: `Does the request itself mention or directly describe the ${label}? Answer no if it only asks for an expression or mood, an age, a drawing style or a transformation such as zombie or party.` }; });
  // Generation hints: is this a whole new character, and which presentation and age does it describe?
  questions.intent = choice('What kind of message is this?', desc(V.INTENT));
  questions.presentation = choice('Which gender presentation does the request describe, if any?', desc(V.PRESENTATION));
  questions.age = choice('Which age does the request describe, if any?', desc(V.AGE));

  const started = Date.now();
  const res = await env.AI.run(FLASH, { model: 'clef-flash', state: { request: text, current_avatar: describe(t) }, questions });
  const ms = Date.now() - started;
  const A = res.answers || {};
  // Clef returns a probability for every option, including "keep". A part changes only when the model is
  // clearly confident the request is about it: keep below 20% and the chosen value at least 35%.
  const mentioned = (id) => !MENTION_IDS.has(id) || (A['m_' + id]?.noul ?? 1) >= 0.5;
  const decided = (id) => { const a = A[id]; if (!a || a.choice === 'keep' || !mentioned(id)) return null; const p = a.probabilities?.[a.choice] ?? 0; return p >= 0.35 && (a.probabilities?.keep ?? 0) < 0.2 ? a.choice : null; };
  const changed = (fn) => { const before = encode(t); fn(); return encode(t) !== before; };   // codes ignore key order

  const changes = [];
  // New character: start from a random base weighted by presentation and age, then apply what was asked.
  const pNew = A.intent?.probabilities?.new ?? 0;
  const chat = A.intent?.choice === 'none' && (A.intent.probabilities?.none ?? 0) >= 0.5;
  if (chat) return { model: FLASH, ms, usage: res.usage, questions: Object.keys(questions).length, changes: [], traits: t, code: encode(t), expression: null, style: null, intent: 'none', presentation: 'unspecified', age: 'unspecified' };
  const pres = (A.presentation?.probabilities?.[A.presentation.choice] ?? 0) > 0.5 ? A.presentation.choice : 'unspecified';
  let age = (A.age?.probabilities?.[A.age.choice] ?? 0) > 0.5 ? A.age.choice : 'unspecified';
  { const ap = A.age?.probabilities || {}; if (age === 'unspecified' && (ap.older ?? 0) + (ap.senior ?? 0) > 0.6) age = (ap.senior ?? 0) > (ap.older ?? 0) ? 'senior' : 'older'; }
  // "an old man with a beard": a person described by presentation or age leans towards a new character.
  // mode: 'new' comes from the "Describe your character" entry point and always creates a new character.
  const isNew = !chat && (body?.mode === 'new' || pNew >= 0.5 || (pNew >= 0.3 && (pres !== 'unspecified' || age !== 'unspecified')));
  if (isNew){
    t = randomBase(pres, age, t);
    changes.push({ id: 'intent', label: 'new character', choice: [pres, age].filter(x => x !== 'unspecified').join(', ') || 'random', confidence: r2(A.intent.probabilities.new) });
  }
  // A colour that belongs to a part changed in the same request applies more easily ("a red hijab" while wearing a cap).
  const PART_OF = { headwearColor: 'headwear', headwearAccent: 'headwear', frameColor: 'glasses', lens: 'glasses', beardColor: 'facialHair' };
  const loose = (id) => { const a = A[id]; if (!a || a.choice === 'keep') return null; const p = a.probabilities?.[a.choice] ?? 0; return p >= 0.35 && (a.probabilities?.keep ?? 0) < 0.45 ? a.choice : null; };
  TRAITS.forEach(([id, label, map, apply]) => {
    const v = decided(id) || (PART_OF[id] && changes.some(c => c.id === PART_OF[id]) ? loose(id) : null);
    if (v && changed(() => apply(t, v))) changes.push(report(id, label, A[id]));
  });
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
  normalizeHair(t, new Set(changes.map(c => c.id)));
  const er = decided('eyeRender'); if (er) { if (er === 'auto') delete t.eyes.render; else t.eyes.render = er; changes.push(report('eyeRender', 'eye drawing', A.eyeRender)); }
  const expression = decided('expression'), style = decided('style');
  if (expression) changes.push(report('expression', 'expression', A.expression));
  if (style) changes.push(report('style', 'style', A.style));

  return { model: FLASH, ms, usage: res.usage, questions: Object.keys(questions).length, changes, traits: t, code: encode(t), expression, style, intent: isNew ? 'new' : 'edit', presentation: pres, age,
    hints: { intent: A.intent?.probabilities, presentation: A.presentation?.probabilities, age: A.age?.probabilities } };
}

// Keep top and back hair compatible unless both were asked for explicitly.
function normalizeHair(t, asked){
  const h = t.hair, longish = ['long', 'longWavy', 'bob'];
  if (h.back === 'afro' && !['afroTop', 'afroCurly', 'curly'].includes(h.top) && !asked.has('hairTop')) h.top = 'afroTop';
  if (h.top === 'afroTop' && h.back !== 'afro' && !asked.has('hairTop')) h.top = longish.includes(h.back) ? 'centerPart' : 'curly';
  if (h.top === 'afroTop' && h.back !== 'afro' && asked.has('hairTop') && !asked.has('hairBack')) h.back = 'afro';
  // Locs come as a pair: the hairline and the hanging locs.
  if (h.back === 'locs' && !['locsTop', 'none'].includes(h.top) && !asked.has('hairTop')) h.top = 'locsTop';
  if (h.top === 'locsTop' && h.back !== 'locs' && !asked.has('hairBack')) h.back = 'locs';
  // A mohawk or spikes can't sit in front of a full afro.
  if (['mohawk', 'spiky'].includes(h.top) && h.back === 'afro' && asked.has('hairTop') && !asked.has('hairBack')) h.back = 'none';
  if (['none', 'buzz', 'afroCurly', 'mohawk'].includes(h.top) && longish.includes(h.back)){
    if (asked.has('hairTop') && !asked.has('hairBack')) h.back = 'none';
    else if (!asked.has('hairTop')) h.top = 'centerPart';
  }
}

// ---------- avatar names (Clef flash moderation) ----------
// Each check is a yes/no (noul) question; a name is accepted only when every probability stays low.
const NAME_CHECKS = {
  profanity: 'Does this name contain profanity, swear words or obscene language, in any language, including disguised spellings (letters swapped for numbers or symbols, spaces or dots between letters)?',
  hate: 'Is this name hateful, a slur, harassing, or does it insult or demean a person or group (for example by race, religion, gender, sexuality or disability)?',
  sexual: 'Is this name sexual, explicit or a sexual innuendo?',
  violence: 'Does this name promote violence, self-harm, terrorism, or name or glorify an extremist group or a perpetrator of atrocities?',
};
// Real first names and surnames that read as rude words in English. As whole words they are replaced by a
// neutral placeholder before the check, so "Dick Smith" or "Phuc Nguyen" pass while the rest of the name is
// still judged ("Dick Head" keeps "Head" next to a name marker).
const NAME_ALLOW = new Set(['dick','dickie','dicky','willy','willie','fanny','randy','gay','butts','cox','cockburn','dong','wang','hung','phuc','bich','dang','phat','weiner','wiener','dyke','dykes','hooker','cummings','fuchs','kuntz','seaman','batty','kock','koch','titus','assange','bonar','gaylord','bumgarner']);
const maskNames = v => v.replace(/\p{L}+/gu, w => NAME_ALLOW.has(w.toLowerCase()) ? 'Alex' : w);
async function checkName(env, body){
  const name = String(body?.name ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim();
  if (!name) throw fail('Enter a name.');
  if (name.length > 40) throw fail('Names can be up to 40 characters.');
  if (/[<>{}\[\]\\\u0000-\u001f]/.test(name)) throw fail('Names can use letters, numbers, spaces and simple punctuation.');
  const questions = Object.fromEntries(Object.entries(NAME_CHECKS).map(([k, q]) => [k, { type: 'noul', instructions: q }]));
  const allowed = [...new Set((name.match(/\p{L}+/gu) || []).filter(w => NAME_ALLOW.has(w.toLowerCase())))];
  // With allow-listed words, the original name is judged once more: name or insult?
  if (allowed.length) questions.misuse = { type: 'noul', instructions: `The original name is "${name}". The word(s) ${allowed.map(w => `"${w}"`).join(', ')} are real first names or surnames that are also rude slang. Is the original name using them as an insult or a sexual reference rather than as a person's name? For example "Dick Smith", "Randy Newman" or "Phuc Nguyen" are names; "Big Dick", "Dick Head" or "Phuc Off" are not.` };
  if (allowed.length){
    questions.origProfanity = { type: 'noul', instructions: `Read exactly as written, is "${name}" a vulgar or obscene phrase, a sexual reference or an insult (not just a person's name that happens to contain ${allowed.map(w => `"${w}"`).join(', ')})?` };
  }
  const started = Date.now();
  // Also show the model a decoded spelling, so disguised words (sh1t, f.u.c.k) read as what they are.
  const LEET = { '0':'o', '1':'i', '!':'i', '|':'l', '3':'e', '4':'a', '@':'a', '5':'s', '$':'s', '7':'t', '8':'b', '9':'g', '+':'t' };
  const decoded = name.toLowerCase().replace(/[0-9!|@$+]/g, c => LEET[c] || c);
  const joined = decoded.replace(/[^\p{L}]+/gu, '');
  const masked = maskNames(name), wasMasked = masked !== name;
  const res = await env.AI.run(FLASH, { model: 'clef-flash', state: { avatar_name: masked, decoded_spelling: wasMasked ? maskNames(decoded) : decoded, letters_only: wasMasked ? maskNames(decoded).replace(/[^\p{L}]+/gu, '') : joined, ...(wasMasked ? { note: 'Alex stands for a real first name or surname.' } : {}), context: 'A user wants to give this name to their cartoon avatar. Ordinary first names, nicknames, fantasy names and harmless jokes are fine.' }, questions });
  const scores = Object.fromEntries(Object.keys(questions).map(k => [k, r2(res.answers?.[k]?.noul ?? 0)]));
  // Allow-listed names: the masked checks must pass, and the original name must not read as misuse.
  // Measured: real names score <= 0.39 on origProfanity, misuse ("Phuc Off", "Dick Head", "Big Dick") >= 0.44.
  const limit = { misuse: 0.5, origProfanity: 0.42 };
  // A name that is just one allow-listed word ("Dick", "Fanny") is a name.
  if (allowed.length === 1 && name.toLowerCase() === allowed[0].toLowerCase()) { delete scores.misuse; delete scores.origProfanity; }
  const flagged = Object.entries(scores).filter(([k, v]) => v >= (limit[k] ?? 0.5)).map(([k]) => k);
  return { ok: !flagged.length, name, flagged, scores, model: FLASH, ms: Date.now() - started };
}

// ---------- random base for new characters ----------
// Presentation and age only shift probabilities; any feature stays possible for anyone. Face shape and
// skin tone are always uniform.
function randomBase(pres, age, prev){
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const wpick = w => { const tot = Object.values(w).reduce((a, b) => a + b, 0); let r = Math.random() * tot; for (const [k, v] of Object.entries(w)) { if ((r -= v) <= 0) return k; } return Object.keys(w)[0]; };
  const fem = pres === 'feminine', masc = pres === 'masculine';
  const old = age === 'older' || age === 'senior', kid = age === 'child';
  const hairColors = Object.values(V.HAIR_COLOR).map(x => x[0]);
  const natural = hairColors.slice(0, 10);
  const top = wpick(fem ? { centerPart: 4, sidePart: 4, fringe: 3, curly: 2, afroCurly: 2, afroTop: 1.5, short: 1, undercut: .5, buzz: .2, pixie: 1.5, slicked: 1, cornrows: 1, locsTop: .8, bowl: .3 }
               : masc ? { short: 4, undercut: 2, buzz: 2, receding: old ? 4 : .5, curly: 2, afroCurly: 1.5, sidePart: 2, none: old ? 2 : .5, afroTop: 1, slicked: 1.5, spiky: kid ? 2 : 1, mohawk: old ? .1 : .4, cornrows: 1, locsTop: .8, bowl: kid ? 1.5 : .3 }
               : { short: 2, undercut: 2, fringe: 2, sidePart: 2, centerPart: 2, curly: 2, afroCurly: 1.5, buzz: 1, afroTop: 1, pixie: 1.5, mohawk: .5, spiky: 1, slicked: 1, cornrows: .8, locsTop: .8, bowl: .5 });
  // Back hair that suits the top: locs go together, cornrows usually end in braids, tight cuts have none.
  const back = top === 'afroTop' ? 'afro' : top === 'locsTop' ? 'locs'
    : top === 'cornrows' ? wpick(fem ? { braids: 3, none: 1, ponytail: 1 } : { none: 3, braids: 1 })
    : ['afroCurly', 'buzz', 'none', 'receding', 'mohawk', 'spiky', 'bowl'].includes(top) ? 'none'
    : wpick(fem ? { long: 4, longWavy: 3, bob: 2, none: 1, ponytail: 2, bun: 1.5, braids: 1, pigtails: kid ? 1.5 : .3, spaceBuns: .5 }
          : masc ? { none: 8, long: 1, bob: .5, bun: .6, ponytail: .4 } : { none: 3, bob: 2, long: 1.5, longWavy: 1, bun: 1, ponytail: 1, spaceBuns: .4 });
  const color = old && Math.random() < .65 ? pick(['#d4cfc8', '#f4f1ec']) : (Math.random() < .9 ? pick(natural) : pick(hairColors.slice(10)));
  const eye = pick(Object.values(V.EYE_COLOR).map(x => x[0]));
  const t = {
    skin: pick(V.SKIN_LEVELS.map(x => x[0])), face: pick(Object.keys(V.FACE)),
    hair: { top, back, color },
    eyes: { shape: pick(Object.keys(V.EYE_SHAPE)), left: eye, right: eye, lashes: wpick(fem ? { long: 3, natural: 3, none: .5 } : masc ? { none: 4, natural: 1 } : { natural: 2, none: 2, long: .5 }) },
    brows: { type: wpick(fem ? { thin: 2, arched: 3, medium: 2, straight: 1 } : masc ? { thick: 3, bushy: old ? 3 : 1, medium: 2, straight: 2 } : { medium: 2, straight: 2, thin: 1, thick: 1 }) },
    nose: { type: kid ? pick(['button', 'small']) : pick(Object.keys(V.NOSE)) },
    mouth: { width: pick(Object.keys(V.MOUTH_WIDTH)), lips: wpick(fem ? { full: 3, medium: 3, thin: 1 } : { medium: 3, thin: 2, full: 1.5 }) },
    facialHair: kid || fem ? 'none' : masc ? wpick({ none: 4, stubble: 2, full: 2, short: 2, mustache: 1, goatee: 1, long: old ? 1.5 : .3, circle: 1 }) : wpick({ none: 8, stubble: 1 }),
    details: [...(old ? ['wrinkles'] : []), ...(Math.random() < .15 ? ['freckles'] : [])],
    glasses: Math.random() < (old ? .6 : .3) ? { type: pick(['round', 'rect', 'cateye', 'oval', 'wayfarer', 'browline', 'softSquare', 'panto', 'roundSmall', ...(old ? ['half', 'half'] : [])]), frame: pick(Object.values(V.FRAME_COLOR).map(x => x[0])), lens: '#ffffff', lensAlpha: .12 } : { type: 'none' },
    headwear: { type: 'none', color: '#2f6bd8' },
    shirt: pick(Object.values(V.CLOTH).map(x => x[0])), bg: prev?.bg || pick(Object.values(V.BG).slice(0, 10).map(x => x[0])),
  };
  if (kid) setK(t, 'eyes.size', 1);
  return t;
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
