// Worker logic with a stand-in for Workers AI (no network, no cost).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from './worker.js';

const IMG = 'data:image/jpeg;base64,' + Buffer.alloc(64).toString('base64');
// A fake AI binding: every question gets its first allowed answer unless `over` says otherwise.
function fakeAI(over = {}){
  return { async run(model, input){
    const answers = {};
    for (const [id, q] of Object.entries(input.questions)){
      if (id in over){ answers[id] = over[id]; continue; }
      if (q.type === 'noul') answers[id] = { noul: id === 'isPerson' ? .95 : .1 };
      else if (q.type === 'score') answers[id] = { score: 2, confidence: .8 };
      else { const keys = Object.keys(q.criteria); answers[id] = { choice: keys[0], probabilities: Object.fromEntries(keys.map((k, i) => [k, i ? .5 / (keys.length - 1) : .5])) }; }
    }
    return { answers, usage: {} };
  } };
}
const choose = (choice, probs) => ({ choice, probabilities: probs || { [choice]: .9 } });
async function photo(over){
  const env = { AI: fakeAI(over) };
  const res = await worker.fetch(new Request('https://x.test/api/photo', { method: 'POST', body: JSON.stringify({ image: IMG }) }), env);
  return res.json();
}

test('photo without glasses gives an avatar without glasses', async () => {
  // Clef says "no glasses"; the frame colour and lens questions still return some colour.
  const r = await photo({ glasses: choose('none'), frameColor: choose('gold'), lens: choose('sunglasses') });
  assert.equal(r.traits.glasses.type, 'none');
});

test('photo with glasses keeps the detected frame, colour and lens', async () => {
  const r = await photo({ glassesOn: { noul: .92 }, glasses: choose('round'), frameColor: choose('gold'), lens: choose('clear') });
  assert.equal(r.traits.glasses.type, 'round');
});

test('glasses on the face but "none" as top frame type picks the likeliest frame', async () => {
  const r = await photo({ glassesOn: { noul: .8 }, glasses: choose('none', { none: .4, rect: .35, round: .25 }) });
  assert.equal(r.traits.glasses.type, 'rect');
});

test('a frame type without glasses on the face is ignored', async () => {
  const r = await photo({ glassesOn: { noul: .2 }, glasses: choose('aviator'), lens: choose('sunglasses'), frameColor: choose('gold') });
  assert.equal(r.traits.glasses.type, 'none');
});

test('sunglasses on the face come out dark', async () => {
  const r = await photo({ glassesOn: { noul: .9 }, glasses: choose('aviator'), lens: choose('sunglasses'), frameColor: choose('gold') });
  assert.equal(r.traits.glasses.type, 'aviator');
  assert.ok(r.traits.glasses.lensAlpha > .5);
  assert.equal(r.traits.glasses.frame, '#c79a2b');
});
