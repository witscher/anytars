// Evaluates the text-edit AI (/api/edit, Clef flash) against prompts with known expected outcomes.
//
//   node qa/eval-ai.mjs [baseUrl] [maxCases] [perMinute]
//
// Each case is a prompt plus expectations about the final avatar. A case passes when every expected part has
// one of the accepted values (checked on the returned traits, so "already had it" also passes) and no part
// outside the expected and allowed ones was changed. Results go to qa/eval-results.json.
import { writeFile } from 'node:fs/promises';
import { decode } from '../build/anytars-core.mjs';

const BASE = process.argv[2] || 'https://anytars.davebuilds.net';
const MAX = +(process.argv[3] || 1000);
const PER_MIN = +(process.argv[4] || 19);   // stays under the public per-IP limit (20/min)

// Base avatars: the cast (fictional characters).
const BASES = {
  abena: 'v1.AQEFAwABAQEBAgAFAQIAAP8AAP8AAAEAACZrQSjUz8g6IhQ6IhTHmiv___8va9gtfW7z0nrUz8jUz8g',
};
const castCodes = async () => {
  const core = await import('../build/anytars-core.mjs');
  // CAST is not exported from the core module; rebuild a few representative bases from traits instead.
  const t = (o) => core.encode(o);
  return {
    abena: BASES.abena,
    kenji: t({ skin:'#f2cfae', face:'oval', hair:{top:'undercut', back:'none', color:'#1d1a1f'}, eyes:{shape:'monolid', left:'#3a2a20', right:'#3a2a20', lashes:'none'}, brows:{type:'straight'}, nose:{type:'small'}, mouth:{width:'medium', lips:'thin'}, facialHair:'none', details:['freckles'], glasses:{type:'round', frame:'#2b2b33', lens:'#ffffff', lensAlpha:.12}, headwear:{type:'none', color:'#2f6bd8'}, shirt:'#e3554a', bg:'#bfe0f2' }),
    harpreet: t({ skin:'#a8703f', face:'square', hair:{top:'none', back:'none', color:'#1a1416'}, eyes:{shape:'almond', left:'#2e1c12', right:'#2e1c12', lashes:'none'}, brows:{type:'thick'}, nose:{type:'pointed'}, mouth:{width:'wide', lips:'medium'}, facialHair:'full', details:[], glasses:{type:'none'}, headwear:{type:'turban', color:'#d9682b'}, shirt:'#2e4a8c', bg:'#d6e8c4' }),
    wren: t({ skin:'#fbe1d1', face:'heart', hair:{top:'centerPart', back:'longWavy', color:'#b5441f'}, eyes:{shape:'round', left:'#3f8f5a', right:'#4c86c9', lashes:'long'}, brows:{type:'arched'}, nose:{type:'button'}, mouth:{width:'small', lips:'medium'}, facialHair:'none', details:['freckles'], glasses:{type:'none'}, headwear:{type:'witchHat', color:'#3b2b5c'}, shirt:'#6b8f3a', bg:'#f2c6d4' }),
    mateo: t({ skin:'#c98d5b', face:'square', hair:{top:'short', back:'none', color:'#2b1d16'}, eyes:{shape:'round', left:'#3d2618', right:'#3d2618', lashes:'none'}, brows:{type:'thick'}, nose:{type:'broad'}, mouth:{width:'wide', lips:'thin'}, facialHair:'mustache', details:['vitiligo'], glasses:{type:'aviator', frame:'#c0c4cc', lens:'#26303c', lensAlpha:.88}, headwear:{type:'baseballCap', color:'#e8b62c'}, shirt:'#3a3f4a', bg:'#ffc8b8' }),
    beardGlasses: t({ skin:'#efc2a4', face:'round', hair:{top:'receding', back:'none', color:'#6e5038'}, eyes:{shape:'almond', left:'#6f8a7e', right:'#6f8a7e', lashes:'none'}, brows:{type:'thin'}, nose:{type:'broad'}, mouth:{width:'wide', lips:'medium'}, facialHair:'full', details:[], glasses:{type:'rect', frame:'#16161a', lens:'#ffffff', lensAlpha:.1}, headwear:{type:'none', color:'#2f6bd8'}, shirt:'#202027', bg:'#cfe0ee' }),
    marieLike: t({ skin:'#f5d6c4', face:'oval', hair:{top:'sidePart', back:'long', color:'#cfac72'}, eyes:{shape:'almond', left:'#7a93a8', right:'#7a93a8', lashes:'natural'}, brows:{type:'thin'}, nose:{type:'straight'}, mouth:{width:'medium', lips:'full'}, facialHair:'none', details:[], glasses:{type:'none'}, headwear:{type:'none', color:'#2f6bd8'}, shirt:'#b88d6c', bg:'#e3d9ef' }),
  };
};

// Hex values from src/vocab.js, by name, for colour expectations.
import * as V from '../src/vocab.js';
const hexOf = (map, names) => names.map(n => map[n][0]);
const HAIR = n => hexOf(V.HAIR_COLOR, [].concat(n)), CLOTH = n => hexOf(V.CLOTH, [].concat(n)), BG = n => hexOf(V.BG, [].concat(n)), EYE = n => hexOf(V.EYE_COLOR, [].concat(n));

// Readers for the final avatar (and the response) per part id.
const get = {
  face: (t) => t.face, hairTop: (t) => t.hair.top, hairBack: (t) => t.hair.back, hairColor: (t) => t.hair.color, hairAccent: (t) => t.hair.accent || 'none',
  eyeShape: (t) => t.eyes.shape, eyeColor: (t) => t.eyes.left, lashes: (t) => t.eyes.lashes, brows: (t) => t.brows.type, nose: (t) => t.nose.type,
  mouthWidth: (t) => t.mouth.width, lips: (t) => t.mouth.lips, facialHair: (t) => t.facialHair, beardColor: (t) => t.facialHairColor,
  glasses: (t) => t.glasses.type, lens: (t) => t.glasses.lens, frameColor: (t) => t.glasses.frame, headwear: (t) => t.headwear.type,
  headwearColor: (t) => t.headwear.color, headwearAccent: (t) => t.headwear.accent, shirt: (t) => t.shirt, bg: (t) => t.bg,
  expression: (t, r) => r.expression, style: (t, r) => r.style, intent: (t, r) => r.intent, presentation: (t, r) => r.presentation, age: (t, r) => r.age,
  freckles: (t) => t.details.includes('freckles'), wrinkles: (t) => t.details.includes('wrinkles'), mole: (t) => t.details.includes('mole'), vitiligo: (t) => t.details.includes('vitiligo'),
  eyeRender: (t) => t.eyes.render || 'auto',
};
const NOT_NONE = '*'; // any value except 'none'

// Which reported change ids each expectation also allows.
const COUPLED = {
  hairTop: ['hairBack', 'headwear'], hairBack: ['hairTop'], facialHair: ['slider_beard_length', 'slider_beard_thickness', 'beardColor'],
  glasses: ['lens', 'frameColor'], lens: ['glasses'], frameColor: ['glasses'], headwear: ['headwearColor', 'headwearAccent', 'expression'],
  headwearColor: ['headwear'], expression: ['headwear'], beardColor: ['facialHair'], hairColor: ['hairAccent'], hairAccent: ['hairColor'],
};
const changeIdFor = { freckles: 'detail_freckles', wrinkles: 'detail_wrinkles', mole: 'detail_mole', vitiligo: 'detail_vitiligo' };

// [prompt, expectations, extraAllowedChangeIds?]
const C = [];
const add = (text, expect, allow = []) => C.push({ text, expect, allow });
// hair
add('give me a buzz cut', { hairTop: ['buzz'] }); add('shave the head completely', { hairTop: ['none'] }); add('I want an undercut', { hairTop: ['undercut'] });
add('add bangs', { hairTop: ['fringe'] }); add('part the hair in the middle', { hairTop: ['centerPart'] }); add('side parting please', { hairTop: ['sidePart'] });
add('short curly hair', { hairTop: ['curly'] }); add('a big curly afro', { hairTop: ['afroCurly', 'afroTop', 'curly'] }); add('receding hairline', { hairTop: ['receding'] });
add('a short classic haircut', { hairTop: ['short'] }); add('long hair', { hairBack: ['long', 'longWavy'] }); add('long wavy hair', { hairBack: ['longWavy'] });
add('give her a bob', { hairBack: ['bob'] }); add('cut the long hair off', { hairBack: ['none'] }, ['hairTop']);
for (const [w, n] of [['black','black'],['brown',['brown','mediumBrown','darkBrown','lightBrown']],['blonde',['blonde','platinum']],['red',['auburn','ginger']],['ginger',['ginger','auburn']],['grey',['grey']],['white',['white','grey']],['blue','blue'],['pink','pink'],['green','green'],['purple','purple']])
  add(`make the hair ${w}`, { hairColor: HAIR(n) });
add('she should be a redhead', { hairColor: HAIR(['auburn','ginger']) }); add('dye it platinum', { hairColor: HAIR(['platinum','blonde','white']) });
add('add pink streaks', { hairAccent: HAIR('pink') }); add('blonde highlights', { hairAccent: HAIR(['blonde','platinum']) }); add('remove the highlights', { hairAccent: ['none', undefined] });
// eyes and brows
for (const [w, n] of [['blue','blue'],['green','green'],['brown',['brown','darkBrown']],['hazel','hazel'],['grey',['greyBlue','greyGreen']],['amber','amber']]) add(`${w} eyes`, { eyeColor: EYE(n) });
add('almond shaped eyes', { eyeShape: ['almond'] }); add('round eyes', { eyeShape: ['round'] }); add('monolid eyes', { eyeShape: ['monolid'] });
add('long eyelashes', { lashes: ['long'] }); add('no eyelashes', { lashes: ['none'] });
add('thick eyebrows', { brows: ['thick','bushy'] }); add('thin eyebrows', { brows: ['thin'] }); add('arched brows', { brows: ['arched'] }); add('bushy eyebrows', { brows: ['bushy'] });
add('dot eyes', { eyeRender: ['dot'] }); add('glossy button eyes', { eyeRender: ['button'] });
// nose and mouth
add('a small nose', { nose: ['small','button'] }, ['slider_nose_size']); add('a long pointy nose', { nose: ['pointed'] }, ['slider_nose_size']); add('a broad nose', { nose: ['broad'] }, ['slider_nose_size']);
add('a wide mouth', { mouthWidth: ['wide'] }, ['slider_mouth_size']); add('full lips', { lips: ['full'] }); add('thin lips', { lips: ['thin'] });
// facial hair
add('add a full beard', { facialHair: ['full','long','short'] }); add('clean shaven', { facialHair: ['none'] }); add('add a moustache', { facialHair: ['mustache','handlebar','pencil'] });
add('a goatee', { facialHair: ['goatee'] }); add('handlebar moustache', { facialHair: ['handlebar'] }); add('some stubble', { facialHair: ['stubble'] });
add('mutton chops', { facialHair: ['muttonChops'] }); add('a soul patch', { facialHair: ['soulPatch'] }); add('a long beard', { facialHair: ['long','full'] });
add('a grey beard', { beardColor: HAIR(['grey','white']) }, ['facialHair']); add('a short trimmed beard', { facialHair: ['short','full'] });
// glasses
add('add round glasses', { glasses: ['round','roundSmall','thickRound','oversized'] }); add('rectangular glasses', { glasses: ['rect','narrow','square','softSquare'] });
add('cat-eye glasses', { glasses: ['cateye'] }); add('aviators', { glasses: ['aviator'] }); add('reading glasses', { glasses: ['half'] }); add('a monocle', { glasses: ['monocle'] });
add('remove the glasses', { glasses: ['none'] }); add('add glasses', { glasses: [NOT_NONE] }); add('heart shaped glasses', { glasses: ['heart'] });
add('sunglasses', { lens: [V.LENS.sunglasses[0], V.LENS.mirrored[0]] }, ['glasses']); add('gold frames', { frameColor: [V.FRAME_COLOR.gold[0]] }, ['glasses']);
// headwear
for (const [w, n] of [['a baseball cap','baseballCap'],['a beanie','beanie'],['a witch hat','witchHat'],['a wizard hat','witchHat'],['an elf hat','elfCap'],['a mushroom hat','mushroom'],['a jester hat','jester'],['devil horns','devilHorns'],['a kippah','kippah'],['a yarmulke','kippah'],['a turban','turban'],['a dastar','turban'],['a hijab','hijab'],['a headscarf','hijab'],['a party hat','partyHat']])
  add(`put on ${w}`, { headwear: [n] });
add('remove the hat', { headwear: ['none'] }); add('a red baseball cap', { headwear: ['baseballCap'], headwearColor: CLOTH('red') });
// clothes, background, skin
add('a black shirt', { shirt: CLOTH('black') }); add('white t-shirt', { shirt: CLOTH('white') }); add('a green top', { shirt: CLOTH(['olive','teal']) });
add('pink background', { bg: BG('pink') }); add('dark background', { bg: BG('dark') }); add('blue background', { bg: BG(['lightBlue','sky']) });
add('darker skin', {}, ['skin']); add('lighter skin', {}, ['skin']);
// details and sliders
add('add freckles', { freckles: [true] }); add('remove the freckles', { freckles: [false] }); add('add a beauty mark', { mole: [true] }); add('make her older', { wrinkles: [true] }, ['hairColor']);
add('bigger eyes', {}, ['slider_eyes_size']); add('a smaller nose', {}, ['slider_nose_size', 'nose']); add('push the glasses up', {}, ['slider_glasses_y']);
// expressions, transforms, styles
for (const [w, n] of [['make him smile',['happy','laughing']],['make her sad',['sad','crying']],['angry face',['angry']],['surprised look',['surprised']],['make them cry',['crying']],['laughing out loud',['laughing']],['turn into a zombie',['zombie']],['a party version',['festive']]])
  add(w, { expression: n });
for (const [w, n] of [['anime style','anime'],['chibi style','chibi'],['flat style','flat'],['as a sticker','sticker'],['cel shaded','cel']]) add(w, { style: [n] });
// face shapes
for (const [w, n] of [['a round face',['round']],['a square jaw',['square','rectangle']],['a heart-shaped face',['heart']],['a long face',['long','rectangle']],['a diamond face shape',['diamond']],['an oval face',['oval']]]) add(w, { face: n });
// combinations
add('long blonde hair and round glasses', { hairBack: ['long','longWavy'], hairColor: HAIR(['blonde','platinum']), glasses: ['round','roundSmall','thickRound','oversized'] });
add('a red hijab and cat-eye glasses', { headwear: ['hijab'], headwearColor: CLOTH('red'), glasses: ['cateye'] });
add('buzz cut, full beard and a black shirt', { hairTop: ['buzz'], facialHair: ['full','long','short'], shirt: CLOTH('black') });
add('pink hair, freckles and a witch hat', { hairColor: HAIR('pink'), freckles: [true], headwear: ['witchHat'] });
add('anime style with long blue hair', { style: ['anime'], hairBack: ['long','longWavy'], hairColor: HAIR('blue') });
// nothing to change
for (const w of ['hello', 'thanks!', 'looks great', 'keep it as it is', 'what can you do?', 'nice', 'I like it', 'perfect, no changes']) add(w, {});
// new characters
add('a random feminine character', { intent: ['new'], presentation: ['feminine'] }, ['*']);
add('a random masculine character', { intent: ['new'], presentation: ['masculine'] }, ['*']);
add('a random person', { intent: ['new'] }, ['*']);
add('create a woman with curly hair', { intent: ['new'], presentation: ['feminine'], hairTop: ['curly','afroCurly'] }, ['*']);
add('an old man with a beard', { intent: ['new'], presentation: ['masculine'], age: ['older','senior'], facialHair: [NOT_NONE] }, ['*']);
add('a kid with freckles', { intent: ['new'], age: ['child'], freckles: [true] }, ['*']);
add('a non-binary teen with pink hair', { intent: ['new'], presentation: ['androgynous'], age: ['young','child'], hairColor: HAIR('pink') }, ['*']);
add('a girl with a witch hat', { intent: ['new'], presentation: ['feminine'], headwear: ['witchHat'] }, ['*']);
add('a bald man with sunglasses', { intent: ['new'], presentation: ['masculine'], hairTop: ['none','buzz'], lens: [V.LENS.sunglasses[0], V.LENS.mirrored[0]] }, ['*']);

const bases = await castCodes();
let jobs = [];
for (const c of C) for (const [bn, code] of Object.entries(bases)) jobs.push({ ...c, base: bn, code });
// RETEST=1: every prompt that failed last time (all bases) plus every 4th passing prompt (3 bases), to catch regressions.
if (process.env.RETEST){
  const prev = JSON.parse(await (await import('node:fs/promises')).readFile(new URL('./eval-results.json', import.meta.url), 'utf8'));
  const failed = new Set(prev.filter(r => !r.ok).map(r => r.text));
  const passing = [...new Set(prev.filter(r => r.ok && !failed.has(r.text)).map(r => r.text))].filter((_, i) => i % 4 === 0);
  const keepBases = new Set(Object.keys(bases).slice(0, 3));
  jobs = jobs.filter(j => failed.has(j.text) || (passing.includes(j.text) && keepBases.has(j.base)));
}
jobs.splice(MAX);

const sleep = ms => new Promise(r => setTimeout(r, ms));
const results = [], gap = 60000 / PER_MIN;
console.log(`${jobs.length} requests (${C.length} prompts x ${Object.keys(bases).length} bases), ~${Math.round(jobs.length / PER_MIN)} min`);
for (let k = 0; k < jobs.length; k++){
  const j = jobs[k], start = Date.now();
  let res;
  for (let tries = 0; tries < 4; tries++){
    const r = await fetch(BASE + '/api/edit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: j.text, traits: decode(j.code) }) });
    res = await r.json().catch(() => ({ error: 'bad json' }));
    if (r.status !== 429) break;
    await sleep(15000);
  }
  const t = res.traits, problems = [];
  if (res.error || !t) problems.push('error: ' + res.error);
  else {
    for (const [id, ok] of Object.entries(j.expect)){
      const v = get[id](t, res);
      const pass = ok.includes(NOT_NONE) ? (v && v !== 'none') : ok.includes(v);
      if (!pass) problems.push(`${id}=${v} (want ${ok.join('|')})`);
    }
    if (!j.allow.includes('*')){
      const allowed = new Set([...Object.keys(j.expect).map(id => changeIdFor[id] || id), ...j.allow, ...Object.keys(j.expect).flatMap(id => COUPLED[id] || [])]);
      for (const ch of res.changes || []) if (!allowed.has(ch.id)) problems.push(`unexpected ${ch.id}→${ch.choice} ${Math.round(ch.confidence*100)}%`);
      if (!Object.keys(j.expect).length && j.allow.length && !(res.changes || []).some(ch => j.allow.includes(ch.id))) problems.push(`no change (want ${j.allow.join('|')})`);
    }
  }
  results.push({ text: j.text, base: j.base, ok: !problems.length, problems, ms: res.ms, tokens: res.usage?.input_tokens, changes: res.changes, intent: res.intent });
  if ((k + 1) % 50 === 0) console.log(`${k + 1}/${jobs.length}  pass ${results.filter(r => r.ok).length}`);
  await writeFile(new URL('./eval-results.json', import.meta.url), JSON.stringify(results, null, 1));
  const wait = gap - (Date.now() - start); if (wait > 0) await sleep(wait);
}
const pass = results.filter(r => r.ok).length;
console.log(JSON.stringify({ requests: results.length, pass, rate: Math.round(pass / results.length * 1000) / 10, medianMs: results.map(r => r.ms).filter(Boolean).sort((a, b) => a - b)[Math.floor(results.length / 2)] }));
