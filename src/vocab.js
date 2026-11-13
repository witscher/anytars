// Vocabulary that maps avatar traits to Clef questions.
// Every option id is a real trait value (or a palette colour name); descriptions are what the model reads.

export const FACE = {
  oval: 'oval face, a little longer than wide',
  round: 'round, full face',
  square: 'square face with a strong, wide jaw',
  heart: 'heart-shaped face: wide forehead, narrow pointed chin',
  long: 'long, narrow face',
  diamond: 'diamond-shaped face: widest at the cheekbones, narrow forehead and pointed chin',
  rectangle: 'long rectangular face with a strong, straight jaw',
  triangle: 'triangle face: narrow forehead, jaw wider than the forehead',
};

// Generation hints (not stored on the avatar): steer the random parts of a new character.
export const INTENT = {
  edit: 'a change to the current avatar: add, remove or change something, e.g. "add glasses", "make the hair blonde", "bigger eyes", "anime style", "make her sad"',
  new: 'a new character described as a whole person, e.g. "a kid with freckles", "a bald man with sunglasses", "a girl with a witch hat", "an old woman", "a random feminine character", "create a non-binary teen"',
  none: 'not a request to change or create anything: a greeting, thanks, praise, a question, or asking to keep it as it is',
};
export const PRESENTATION = {
  unspecified: 'no gender presentation mentioned', feminine: 'feminine (woman, girl, female, feminine)',
  masculine: 'masculine (man, boy, male, masculine)', androgynous: 'androgynous or non-binary',
};
export const AGE = {
  unspecified: 'no age mentioned', child: 'a child or kid', young: 'a teenager or young adult',
  adult: 'an adult', older: 'middle-aged or older', senior: 'elderly, a senior',
};

export const HAIR_TOP = {
  none: 'bald or fully shaved head',
  short: 'short classic haircut',
  undercut: 'undercut: shaved sides with a longer swept-up top',
  fringe: 'straight bangs (a fringe) across the forehead',
  centerPart: 'hair parted in the middle',
  sidePart: 'hair parted on one side and swept across',
  afroTop: 'afro-textured hairline (for a round afro behind the head)',
  buzz: 'buzz cut, very short all over',
  curly: 'short curly hair',
  afroCurly: 'big, voluminous curly afro',
  receding: 'short hair with a receding hairline',
};

export const HAIR_BACK = {
  none: 'no long hair: short, ends above the ears or neck',
  bob: 'chin-length bob',
  long: 'long straight hair to or past the shoulders',
  longWavy: 'long wavy or curly hair past the shoulders',
  afro: 'big, rounded afro',
};

export const HAIR_COLOR = {
  black: ['#1d1a1f', 'black hair'], darkBrown: ['#2b1d16', 'dark brown hair'], brown: ['#4a3222', 'brown hair'],
  mediumBrown: ['#6e5038', 'medium brown hair'], lightBrown: ['#8a6440', 'light brown hair'], blonde: ['#cfac72', 'blonde hair'],
  platinum: ['#e6cf98', 'very light, platinum blonde hair'], auburn: ['#b5441f', 'auburn or red hair'], ginger: ['#d06a2c', 'ginger or copper hair'],
  grey: ['#d4cfc8', 'grey hair'], white: ['#f4f1ec', 'white hair'], blue: ['#3d6fd8', 'dyed blue hair'], pink: ['#d65a9c', 'dyed pink hair'],
  green: ['#4caf7a', 'dyed green hair'], purple: ['#7b4fc9', 'dyed purple hair'],
};

export const EYE_SHAPE = {
  round: 'round, wide-open eyes', almond: 'almond-shaped eyes',
  monolid: 'monolid eyes without a visible crease', downturned: 'eyes that slope down at the outer corners',
};

export const EYE_COLOR = {
  darkBrown: ['#2e1c12', 'dark brown eyes'], brown: ['#5b3b22', 'brown eyes'], hazel: ['#8a6a2f', 'hazel eyes'],
  green: ['#3f8f5a', 'green eyes'], blue: ['#4c86c9', 'blue eyes'], greyBlue: ['#7a93a8', 'grey-blue eyes'],
  greyGreen: ['#6f8a7e', 'grey-green eyes'], amber: ['#a77a2e', 'amber eyes'], violet: ['#6a4a9a', 'violet eyes'],
};

export const LASHES = { none: 'no visible eyelashes', natural: 'natural eyelashes', long: 'long, prominent eyelashes' };

export const BROWS = {
  thin: 'thin eyebrows', medium: 'medium eyebrows', thick: 'thick eyebrows', bushy: 'very bushy eyebrows',
  arched: 'high, arched eyebrows', straight: 'straight, flat eyebrows',
};

export const NOSE = {
  button: 'small button nose', broad: 'broad nose with wide nostrils', straight: 'straight nose',
  pointed: 'long or pointed nose', small: 'very small nose',
};

export const MOUTH_WIDTH = { small: 'small mouth', medium: 'medium mouth', wide: 'wide mouth' };
export const LIPS = { thin: 'thin lips', medium: 'medium lips', full: 'full lips' };

export const FACIAL_HAIR = {
  none: 'clean-shaven, no facial hair', stubble: 'stubble, a few days of growth', mustache: 'moustache only',
  goatee: 'goatee with a moustache', full: 'full beard', short: 'short, neatly trimmed boxed beard', long: 'long full beard',
  circle: 'moustache connected to a chin beard (circle beard)', chinStrap: 'thin beard line along the jaw (chin strap)',
  handlebar: 'handlebar moustache with curled ends', pencil: 'thin pencil moustache', soulPatch: 'small soul patch under the lower lip',
  muttonChops: 'mutton chops: big sideburns joined by a moustache, no chin beard',
};

export const GLASSES = {
  none: 'no glasses', round: 'round frames', rect: 'rectangular frames', cateye: 'cat-eye frames', aviator: 'aviator frames',
  half: 'reading glasses (half-rim, sitting low on the nose)', monocle: 'a monocle', oval: 'oval frames', wayfarer: 'wayfarer frames',
  browline: 'browline frames with a thick top bar', hexagon: 'hexagonal frames', rimless: 'rimless glasses',
  oversized: 'oversized round frames', heart: 'heart-shaped novelty glasses', star: 'star-shaped party glasses',
  shield: 'one-piece shield visor sunglasses', pinceNez: 'pince-nez glasses without arms', square: 'thick square frames',
  softSquare: 'square frames with soft rounded corners', panto: 'panto frames, round bottom and flatter top',
  narrow: 'narrow, slim rectangular frames', semiRim: 'semi-rimless frames, rim only on top',
  roundSmall: 'small round wire frames', octagon: 'octagonal wire frames', thickRound: 'thick round frames',
};

export const LENS = {
  clear: ['#ffffff', .12, 'clear lenses (normal glasses)'],
  tinted: ['#e86a8a', .4, 'lightly tinted lenses'],
  sunglasses: ['#1d2229', .9, 'dark sunglasses lenses'],
  mirrored: ['#3a8fd8', .75, 'mirrored blue lenses'],
};

export const FRAME_COLOR = {
  black: ['#16161a', 'black frames'], darkGrey: ['#2b2b33', 'dark grey frames'], burgundy: ['#7a2f2f', 'burgundy frames'],
  tortoise: ['#8a5a3c', 'brown or tortoiseshell frames'], gold: ['#c79a2b', 'gold frames'], silver: ['#c0c4cc', 'silver frames'],
  pink: ['#d0457a', 'pink frames'], blue: ['#2f6bd8', 'blue frames'],
};

export const HEADWEAR = {
  none: 'nothing on the head', baseballCap: 'baseball cap', hardHat: 'hard hat or construction helmet', beanie: 'knitted beanie', witchHat: 'pointed witch or wizard hat',
  elfCap: 'long pointed green elf cap', mushroom: 'big mushroom-cap hat', jester: 'jester hat with bells', devilHorns: 'devil horns',
  kippah: 'kippah (yarmulke)', turban: 'turban or Sikh dastar', hijab: 'hijab headscarf covering the hair', partyHat: 'cone party hat',
};

export const CLOTH = {
  black: ['#202027', 'black'], charcoal: ['#3a3f4a', 'charcoal grey'], white: ['#f0ede6', 'white or off-white'], red: ['#e3554a', 'red'],
  orange: ['#d9682b', 'orange'], yellow: ['#e8c35a', 'yellow or mustard'], olive: ['#6b8f3a', 'olive green'], teal: ['#2d7d6e', 'teal'],
  blueGrey: ['#3d5a80', 'blue-grey or denim'], navy: ['#2e4a8c', 'navy or royal blue'], plum: ['#7a3b69', 'plum or purple'],
  camel: ['#b88d6c', 'camel, beige or tan'], magenta: ['#d6246e', 'magenta or hot pink'],
};

export const BG = {
  lightBlue: ['#cfe0ee', 'light blue'], sky: ['#bfe0f2', 'sky blue'], mint: ['#cde6e1', 'mint'], sage: ['#d6e8c4', 'sage green'],
  yellow: ['#f3d27a', 'yellow'], peach: ['#ffd9b0', 'peach'], coral: ['#ffc8b8', 'coral'], pink: ['#f2c6d4', 'pink'],
  lavender: ['#e3d9ef', 'lavender'], grey: ['#e6e7ec', 'light grey'], dark: ['#2b2d3a', 'dark navy'],
};

// Skin tone is an ordered score, lightest first; the result can land between levels and is blended.
export const SKIN_LEVELS = [
  ['#fbe3d3', 'very light, pale'], ['#f5d6c4', 'light'], ['#f2cfae', 'light, warm'], ['#e2ad84', 'light-medium'],
  ['#d0a27a', 'medium'], ['#c98d5b', 'olive or tan'], ['#a8703f', 'medium brown'], ['#8a5530', 'brown'],
  ['#6b4128', 'dark brown'], ['#4a2b1a', 'very dark, deep brown'],
];

export const EXPRESSION = {
  neutral: 'neutral face', happy: 'happy, smiling', laughing: 'laughing', sincere: 'sincere, gentle, earnest',
  sad: 'sad', crying: 'crying', surprised: 'surprised', angry: 'angry',
  zombie: 'transformation: turned into a zombie (undead, spooky, Halloween)', festive: 'transformation: festive party version (celebration, birthday, party hat)',
};

export const STYLE = { chibi: 'chibi style', cel: 'soft cel-shaded style', flat: 'flat style', anime: 'anime style', sticker: 'sticker style' };

export const EYE_RENDER = {
  auto: 'the style default eyes', detailed: 'detailed eyes with iris and highlights', bean: 'solid bean-shaped eyes',
  flatIris: 'white eyes with a flat coloured iris', dot: 'small dot eyes', beanLid: 'bean eyes with a lid line', button: 'glossy button eyes',
};

export const DETAILS = { freckles: 'freckles', wrinkles: 'wrinkles (signs of age)', mole: 'a mole or beauty mark', vitiligo: 'vitiligo skin patches' };

// Relative slider changes the text editor understands: [trait path, label, more, less]
export const SLIDERS = [
  ['eyes.size', 'eye size', 'bigger eyes', 'smaller eyes'],
  ['nose.size', 'nose size', 'bigger nose', 'smaller nose'],
  ['mouth.size', 'mouth size', 'bigger mouth', 'smaller mouth'],
  ['beard.length', 'beard length', 'longer beard', 'shorter beard'],
  ['beard.thickness', 'beard thickness', 'thicker, fuller beard', 'thinner beard'],
  ['glasses.y', 'glasses height', 'glasses lower down the nose', 'glasses higher up'],
];

export const CHEEKS = { none: 'no blush on the cheeks', light: 'lightly rosy cheeks', medium: 'rosy cheeks', strong: 'strongly flushed, very rosy cheeks' };
