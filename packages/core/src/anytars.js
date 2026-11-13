/*!
 * anytars - SVG avatars for humans in their diversity.
 * One person, many versions: traits + variant (expression or transform) + style -> SVG string.
 * No dependencies; runs in browsers, Node (>= 18) and Cloudflare Workers.
 */
/* =====================================================================
   anytars prototype renderer. Plain JS, no dependencies.
   traits (identity) + variant (expression | transform) + style -> SVG
   ===================================================================== */

// ---------- colour helpers ----------
const hx = h => { h = String(h||'#888888').replace('#',''); if (h.length===3) h = h.split('').map(c=>c+c).join(''); const v = [0,2,4].map(i => parseInt(h.substr(i,2),16)); return v.some(isNaN) ? [136,136,136] : v; };
const toHex = a => '#' + a.map(v => Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('');
const mix = (a,b,t) => { const A=hx(a),B=hx(b); return toHex(A.map((v,i)=>v+(B[i]-v)*t)); };
const darken = (c,t) => mix(c,'#2a1630',t);
const lighten = (c,t) => mix(c,'#ffffff',t);
const desat = (c,t) => { const [r,g,b]=hx(c); const l=.3*r+.59*g+.11*b; return toHex([r,g,b].map(v=>v+(l-v)*t)); };
const n1 = v => Math.round(v*10)/10;

// Layer tag: every part of an avatar sits in a <g data-l="name"> so tools (QA, editors) can address it.
const tag = (name, s) => s ? `<g data-l="${name}">${s}</g>` : '';
let _uid = 0; const uid = p => p + (++_uid).toString(36);

// ---------- path helpers ----------
// Closed Catmull-Rom spline through points; a point [x,y,'s'] is a sharp corner.
function smooth(pts){
  const n = pts.length; let d = `M${n1(pts[0][0])},${n1(pts[0][1])}`;
  for (let i=0;i<n;i++){
    const p0=pts[(i-1+n)%n], p1=pts[i], p2=pts[(i+1)%n], p3=pts[(i+2)%n];
    const c1 = p1[2]==='s' ? p1 : [p1[0]+(p2[0]-p0[0])/6, p1[1]+(p2[1]-p0[1])/6];
    const c2 = p2[2]==='s' ? p2 : [p2[0]-(p3[0]-p1[0])/6, p2[1]-(p3[1]-p1[1])/6];
    d += `C${n1(c1[0])},${n1(c1[1])} ${n1(c2[0])},${n1(c2[1])} ${n1(p2[0])},${n1(p2[1])}`;
  }
  return d + 'Z';
}
const circ = (cx,cy,r) => `M${n1(cx-r)},${n1(cy)}a${n1(r)},${n1(r)} 0 1,0 ${n1(2*r)},0a${n1(r)},${n1(r)} 0 1,0 ${n1(-2*r)},0Z`;
const ell = (cx,cy,rx,ry) => `M${n1(cx-rx)},${n1(cy)}a${n1(rx)},${n1(ry)} 0 1,0 ${n1(2*rx)},0a${n1(rx)},${n1(ry)} 0 1,0 ${n1(-2*rx)},0Z`;
const mirrorPts = pts => pts.slice().reverse().map(p => p[2] ? [200-p[0],p[1],p[2]] : [200-p[0],p[1]]);

// ---------- face geometry ----------
const FACES = {
  oval:   {top:50,w:44,cheekY:100,jw:36,jawY:130,chinY:156,chinW:13},
  round:  {top:52,w:48,cheekY:104,jw:42,jawY:130,chinY:154,chinW:20},
  square: {top:52,w:46,cheekY:98, jw:44,jawY:136,chinY:154,chinW:24},
  heart:  {top:50,w:48,cheekY:94, jw:32,jawY:130,chinY:156,chinW:9},
  long:   {top:46,w:41,cheekY:100,jw:35,jawY:136,chinY:160,chinW:13},
  // added later; appended so codes keep their indices
  diamond:  {top:52,w:47,cheekY:104,jw:31,jawY:132,chinY:157,chinW:8},
  rectangle:{top:46,w:43,cheekY:98, jw:42,jawY:140,chinY:160,chinW:24},
  triangle: {top:54,w:41,cheekY:104,jw:45,jawY:134,chinY:154,chinW:26},
};
function faceGeom(name){
  const f = {...FACES[name]};
  f.sx = f.w/44; f.dy = f.top-50;
  f.eyeY = f.cheekY+6; f.noseY = f.cheekY+24; f.mouthY = Math.round((f.noseY+f.chinY)/2)+1;
  f.m = p => p[2] ? [100+(p[0]-100)*f.sx, p[1]+f.dy, p[2]] : [100+(p[0]-100)*f.sx, p[1]+f.dy];
  f.mp = pts => pts.map(f.m);
  return f;
}
// Head outline as cubic segments: top->cheekR->jawR->chin->jawL->cheekL->top
function headSegs(F){
  const {top:t,w,cheekY:cy,jw,jawY:jy,chinY:by,chinW:bw}=F, X=100;
  const vx = -(w-jw)*0.3-(jw-bw)*0.15, vy = (by-jy)*0.35;
  return [
    [[X,t],[X+w*0.62,t],[X+w,t+(cy-t)*0.42],[X+w,cy]],
    [[X+w,cy],[X+w,cy+(jy-cy)*0.5],[X+jw-vx,jy-vy],[X+jw,jy]],
    [[X+jw,jy],[X+jw+vx*1.2,jy+vy*1.2],[X+bw+4,by],[X,by]],
    [[X,by],[X-bw-4,by],[X-jw-vx*1.2,jy+vy*1.2],[X-jw,jy]],
    [[X-jw,jy],[X-jw+vx,jy-vy],[X-w,cy+(jy-cy)*0.5],[X-w,cy]],
    [[X-w,cy],[X-w,t+(cy-t)*0.42],[X-w*0.62,t],[X,t]]];
}
function headPath(F){
  const S = headSegs(F);
  return `M${n1(S[0][0][0])},${n1(S[0][0][1])}` + S.map(([,a,b,c])=>`C${n1(a[0])},${n1(a[1])} ${n1(b[0])},${n1(b[1])} ${n1(c[0])},${n1(c[1])}`).join('') + 'Z';
}
const bez = ([p0,p1,p2,p3],u) => { const a=(1-u)**3,b=3*(1-u)**2*u,c=3*(1-u)*u*u,d=u**3; return [a*p0[0]+b*p1[0]+c*p2[0]+d*p3[0], a*p0[1]+b*p1[1]+c*p2[1]+d*p3[1]]; };

// ---------- styles ----------
const STYLES = {
  chibi:   {key:'chibi',   label:'Chibi',       line:'#3a2836', sw:2.8, tinted:false, shade:'hard', bg:'sparkle',  bgShape:'rounded', head:1.12, headY:124, eye:1.56, eyeDY:8, eyeDX:20, body:.56, sticker:false,
            chibi:true, eyeDefault:'beanLid', noseSmall:true, noseDY:6, noseScale:.9, mouthDY:3, mouthScale:.8, blush:.38,
            blurb:'Two-to-one head and body, huge layered eyes, tiny nose and mouth. The most expressive and cutest.'},
  cel:     {key:'cel',     label:'Soft cel',    line:null,      sw:1.7, tinted:true,  shade:'cel',  bg:'circle',   bgShape:'circle', head:1.17, headY:123, eye:1,    eyeDY:0, eyeDX:18, body:.8,   sticker:false, eyeDefault:'flatIris',
            blurb:'Tinted thin lines, two hard-edged shadow tones and hair highlights. The most illustrated.'},
  flat:    {key:'flat',    label:'Flat',        line:null,      sw:0,   tinted:false, shade:'none', bg:'square',   bgShape:'full', head:1.17, headY:123, eye:1,    eyeDY:0, eyeDX:18, body:.8,   sticker:false, eyeDefault:'bean',
            blurb:'No outlines, no shading. Clean and UI-friendly, relies on colour contrast.'},
  anime:   {key:'anime',   label:'Anime',       line:'#3b2433', sw:1.5, tinted:true,  shade:'cel',  bg:'gradient', bgShape:'rounded', head:1.02, headY:114, eye:1.22, eyeDY:3, eyeDX:19, body:.94, sticker:false,
            anime:true, eyeDefault:'detailed', noseMode:'anime', noseDY:1, noseScale:.9, mouthDY:-1, mouthScale:.72, browK:.62,
            blurb:'Tall glossy eyes with heavy lash lines, V-shaped chin, a hint of a nose, hair shine. Thin tinted lineart.'},
  sticker: {key:'sticker', label:'Sticker',     line:'#2a2233', sw:2.6, tinted:false, shade:'hard', bg:'none',     bgShape:'rounded', head:1.1, headY:120, eye:1.42, eyeDY:4, eyeDX:19, body:0.8, sticker:true,
            eyeDefault:'button', noseSmall:true, noseDY:6, noseScale:1.1, mouthDY:2, mouthScale:.85,
            blurb:'Slightly enlarged head and eyes, die-cut white border. Closest to emoji.'},
};
const lineFor = (S, fill) => S.sw===0 ? null : (S.tinted ? darken(fill,.5) : S.line);
const strokeAttr = (S, fill, k=1) => { const c = lineFor(S,fill); return c ? ` stroke="${c}" stroke-width="${n1(S.sw*k)}" stroke-linejoin="round" stroke-linecap="round"` : ''; };

// A filled shape with this style's shading and outline. Light comes from top-left.
// opts.under: draw the outline as a wide stroke beneath (for compound shapes like curls).
function shape(S, d, fill, opts={}){
  const k = opts.k || 1;
  let out = '';
  if (opts.under && S.sw>0) out += `<path d="${d}" fill="${lineFor(S,fill)}" stroke="${lineFor(S,fill)}" stroke-width="${n1(S.sw*2*k)}" stroke-linejoin="round"/>`;
  const st = opts.under ? '' : strokeAttr(S, fill, k);
  const stroke = () => !st ? '' : opts.strokeClip ? `<g clip-path="url(#${opts.strokeClip})"><path d="${d}" fill="none"${st}/></g>` : `<path d="${d}" fill="none"${st}/>`;
  if (S.shade==='none' || opts.noShade){
    let inner = '';
    if (opts.inner){ const ic = uid('c'); inner = `<clipPath id="${ic}"><path d="${d}"/></clipPath><g clip-path="url(#${ic})">${opts.inner}</g>`; }
    if (opts.strokeClip || inner) return out + `<path d="${d}" fill="${fill}"${opts.extra||''}/>` + inner + stroke();
    return out + `<path d="${d}" fill="${fill}"${st}${opts.extra||''}/>`;
  }
  const id = uid('c');
  out += `<clipPath id="${id}"><path d="${d}"/></clipPath><g clip-path="url(#${id})">`;
  if (S.shade==='hard'){
    out += `<path d="${d}" fill="${darken(fill,.22)}"/><path d="${d}" fill="${fill}" transform="translate(-4,-3.4)"/>`;
  } else {
    out += `<path d="${d}" fill="${darken(fill,.32)}"/><path d="${d}" fill="${darken(fill,.16)}" transform="translate(-2.2,-1.8)"/><path d="${d}" fill="${fill}" transform="translate(-7,-5.5)"/>`;
  }
  if (opts.inner) out += opts.inner;
  out += `</g>`;
  return out + stroke();
}

// ---------- hair ----------
function symm(right){ return [...right, ...mirrorPts(right.slice(1,-1))]; }
const HAIR_TOP = {
  none: null,
  short: [[55,104],[53,80],[58,60],[72,45],[100,38],[128,45],[142,60],[147,80],[145,104],[140,104],[138,86],[131,74],[116,69],[100,72,'s'],[86,68],[70,73],[62,86],[60,104]],
  undercut: [[60,84],[58,64],[66,46],[84,32],[108,28],[132,34],[146,50],[147,68],[141,76],[130,66],[112,62],[92,66],[74,72],[64,84]],
  fringe: [[54,112],[52,78],[60,56],[78,42],[100,38],[122,42],[140,56],[148,78],[146,112],[140,112],[138,92],[134,84,'s'],[124,89],[112,83,'s'],[100,89],[88,83,'s'],[76,89],[66,84,'s'],[62,94],[60,112]],
  centerPart: [[53,124],[51,82],[58,58],[76,43],[100,40],[124,43],[142,58],[149,82],[147,124],[141,124],[139,96],[132,78],[116,66],[100,58,'s'],[84,66],[68,78],[61,96],[59,124]],
  afroTop: [[57,98],[57,76],[68,60],[86,52],[100,50],[114,52],[132,60],[143,76],[143,98],[139,98],[135,82],[122,72],[100,70],[78,72],[65,82],[61,98]],
  buzz: [[56,96],[55,74],[64,55],[82,45],[100,43],[118,45],[136,55],[145,74],[144,96],[141,96],[138,80],[128,72],[100,70],[72,72],[62,80],[59,96]],
  curly: 'curly',
  afroCurly: 'afroCurly',
  sidePart: [[53,126],[51,82],[58,58],[76,43],[100,40],[124,43],[142,58],[149,82],[147,126],[141,126],[140,102],[135,86],[124,76],[108,70],[94,64],[86,56,'s'],[80,64],[70,74],[62,92],[59,126]],
  receding: [[57,96],[56,74],[63,56],[78,45],[94,40],[104,37],[112,40,'s'],[122,42],[137,54],[144,74],[143,96],[139,96],[137,80],[130,66],[121,58,'s'],[111,63],[100,65],[89,63],[79,58,'s'],[70,66],[63,80],[61,96]],
};
const HAIR_BACK = {
  none: null,
  // Long hair is one base silhouette: behind the head, around the neck, over the shoulders.
  long: { base: symm([[100,36],[130,41],[149,60],[156,96],[157,140],[160,180],[163,208],[133,208,'s'],[121,190],[116,170],[115,150],[100,146]]) },
  bob:  { behind: [[100,38],[134,44],[152,68],[156,106],[155,136],[141,146],[118,141],[100,143],[82,141],[59,146],[45,136],[44,106],[48,68],[66,44]] },
  afro: { behind: 'afro' },
  longWavy: { base: symm([[100,36],[130,41],[149,60],[157,92],[152,114],[159,136],[153,158],[161,180],[156,208],[132,208,'s'],[124,188],[117,168],[115,150],[100,146]]) },
};
const HAIR_TOP_Y = {none:50, short:38, undercut:28, fringe:38, centerPart:40, afroTop:50, buzz:43, curly:28, receding:37, sidePart:40, afroCurly:7};
const HAIR_TOP_W = {curly:53, afroCurly:66};   // half width (oval coords) for fit-to-canvas; default 49
const HAIR_BACK_Y = {none:99, long:36, bob:38, afro:11, longWavy:36};
// Curly tops: one solid base shape covering the whole hair area (no scalp shows through),
// with curls as bumps along the outer edge and the hairline. big = Afro (curly).
const CURLY = {
  small: { core: [[57,98],[55,72],[64,52],[82,40],[100,36],[118,40],[136,52],[145,72],[143,98],[137,98],[134,82],[122,73],[100,70],[78,73],[66,82],[63,98]],
           c: [100,74], rx: 44, ry: 38, r: 8, n: 13, a0: .93, a1: 2.07, line: [[66,82],[100,60],[134,82]], lr: 4.2, ln: 5 },
  big:   { core: [[49,108],[43,76],[51,44],[73,24],[100,17],[127,24],[149,44],[157,76],[151,108],[140,108],[136,86],[122,75],[100,72],[78,75],[64,86],[60,108]],
           c: [100,66], rx: 54, ry: 47, r: 11, n: 15, a0: .86, a1: 2.14, line: [[64,88],[100,58],[136,88]], lr: 5, ln: 6 },
};
function curlyGeom(F, big){
  const G = CURLY[big ? 'big' : 'small'], bumps = [];
  for (let i=0;i<G.n;i++){ const a = Math.PI*(G.a0 + (G.a1-G.a0)*i/(G.n-1)); bumps.push([G.c[0]+G.rx*Math.cos(a), G.c[1]+G.ry*Math.sin(a), G.r]); }
  for (let i=0;i<G.ln;i++){ const u = i/(G.ln-1), [p0,p1,p2] = G.line;
    bumps.push([(1-u)**2*p0[0]+2*(1-u)*u*p1[0]+u*u*p2[0], (1-u)**2*p0[1]+2*(1-u)*u*p1[1]+u*u*p2[1], G.lr]); }
  return { core: G.core, bumps: bumps.map(([x,y,r]) => { const q = F.m([x,y]); return [q[0], q[1], r*F.sx]; }) };
}
// Circles must wind the same way as the base shape (clockwise here); with the default nonzero fill rule,
// opposite windings cancel where they overlap and leave holes.
const circCW = (cx,cy,r) => `M${n1(cx-r)},${n1(cy)}a${n1(r)},${n1(r)} 0 1,1 ${n1(2*r)},0a${n1(r)},${n1(r)} 0 1,1 ${n1(-2*r)},0Z`;
function curlyD(F, big){
  const g = curlyGeom(F, big);
  return smooth(F.mp(g.core)) + g.bumps.map(([x,y,r]) => circCW(x,y,r)).join('');
}
// Accent lines per hairstyle, in oval coordinates (mapped to the face with F).
const HAIR_ACCENT_TOP = {
  short: ['M70,52 Q84,45 97,47','M108,45 Q124,47 135,58','M63,68 Q71,58 82,55'],
  receding: ['M72,50 Q86,44 98,45','M108,44 Q123,46 133,56'],
  undercut: ['M76,44 Q96,33 119,35','M82,53 Q101,44 125,46','M70,62 Q86,55 101,57'],
  fringe: ['M70,52 Q100,42 130,52','M77,72 L80,86','M92,70 L94,86','M108,70 L106,86','M123,72 L120,86'],
  centerPart: ['M98,46 Q85,52 71,66','M102,46 Q115,52 129,66','M92,59 Q77,69 65,88','M108,59 Q123,69 135,88'],
  sidePart: ['M88,58 Q105,62 125,75','M91,49 Q113,51 135,64','M84,60 Q73,71 65,88'],
  afroTop: ['M70,70 a3,3 0 1,1 4,3','M86,62 a3,3 0 1,1 4,3','M108,62 a3,3 0 1,1 4,3','M124,70 a3,3 0 1,1 4,3'],
};
const HAIR_ACCENT_BACK = {
  long: ['M56,112 Q51,150 54,192','M146,112 Q151,150 148,192','M64,150 Q62,172 64,196','M138,150 Q140,172 138,196'],
  longWavy: ['M56,112 Q48,134 56,156 Q62,176 55,196','M146,112 Q154,134 146,156 Q140,176 147,196'],
  bob: ['M57,108 Q55,124 60,136','M145,108 Q147,124 142,136'],
};
// Open "c" strokes on every other curl (closed rings read as holes at small sizes).
const curlMarks = (pts, k) => pts.filter((p, i) => i % 2 === 0 && p[2] > 6).map(([x,y,r]) => `M${n1(x + r*.3)},${n1(y - r*.35)} a${n1(r*k)},${n1(r*k)} 0 0,0 ${n1(-r*.5)},${n1(r*.7)}`).join(' ');
function hairAccent(F, lines){ return lines ? lines.map(d => `<path d="${d}" fill="none"/>`).join('') : ''; }
function accentGroup(F, inner, color, w){
  return inner ? `<g transform="translate(100,${F.dy}) scale(${n1(F.sx*1000)/1000},1) translate(-100,0)" stroke="${color}" stroke-width="${w}" stroke-linecap="round" fill="none" opacity=".9">${inner}</g>` : '';
}
function afroCurls(F){
  const pts = [];
  for (let i=0;i<16;i++){ const a = i/16*Math.PI*2; if (Math.sin(a) > 0.75) continue; pts.push([100+44*F.sx*Math.cos(a), 80+F.dy+40*Math.sin(a), 9*F.sx]); }
  return pts;
}
function afroD(F){
  let d = ell(100, 80+F.dy, 56*F.sx, 50);
  for (let i=0;i<16;i++){
    const a = i/16*Math.PI*2; if (Math.sin(a) > 0.75) continue;
    d += circ(100+56*F.sx*Math.cos(a), 80+F.dy+50*Math.sin(a), 19*F.sx);
  }
  return d;
}

// ---------- headwear ----------
// Each piece may draw a drape (after the shirt) and a front (over hair). hairMask is the hat's lower edge, left to right:
// hair above that edge and within the hat's width is hidden (the hat covers or replaces it); hair below it shows.
const HEADWEAR = {
  none: {},
  baseballCap: { brimY:98, bandW:50, box:{top:34,x0:48,x1:150}, accent:'#ffffff', accentLabel:'logo', hairMask:[[50,84],[76,78],[100,77],[124,78],[150,84]], front:(S,F,c,ctx,a)=>{
      // Soft six-panel crown in a slight three-quarter view: the cap tilts a little and the visor turns towards
      // the viewer's left, so the centre seam and logo sit off-centre. The visor is no wider than the crown
      // (a brim all round would read as a helmet).
      const crown = smooth(F.mp([[56,81],[56,62],[64,50],[80,42],[100,38],[120,42],[136,50],[144,62],[144,81],[122,76,'s'],[100,75],[78,76,'s']]));
      const bill = smooth(F.mp([[49,80,'s'],[70,73],[93,71],[118,72],[141,77,'s'],[134,87],[114,94],[91,97],[69,95],[54,89]]));
      const under = smooth(F.mp([[54,89,'s'],[72,92],[91,94.5],[114,92],[134,87,'s'],[114,94],[91,97],[69,95]]));
      const shine = `<path d="M62,79 Q90,72 124,76" transform="translate(0,${F.dy})" fill="none" stroke="${lighten(c,.35)}" stroke-width="1.6" stroke-linecap="round" opacity=".7"/>`;
      const seams = ['M103,39 Q96,57 91,75','M103,39 Q86,43 74,55 Q66,65 63,77','M103,39 Q118,44 127,56 Q133,66 134,77'].map(d=>`<path d="${d}" transform="translate(0,${F.dy})" fill="none" stroke="${darken(c,.32)}" stroke-width="1.2" opacity=".65"/>`).join('');
      const side = smooth(F.mp([[120,44],[136,52],[144,64],[144,80],[134,77],[132,62],[124,50]]));   // far side panel in shade
      const logo = `<path d="M87,66 L93,52 L99,66 M89.5,61 L96.5,61" transform="translate(0,${F.dy})" fill="none" stroke="${a}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`;
      return `<g transform="rotate(-6 100 ${80+F.dy})">` + shape(S,crown,c,{inner:`<path d="${side}" fill="${darken(c,.12)}"/>` + seams}) + logo
        + shape(S,circ(103,39+F.dy,2.6),darken(c,.18),{noShade:true,k:.6}) + shape(S,bill,darken(c,.05),{inner:shine}) + `<path d="${under}" fill="${darken(c,.4)}" opacity=".9"/>` + `</g>`;
    }, shadow:[[52,86],[96,95],[140,84],[140,98],[96,103],[56,100]] },
  witchHat: { brimY:75, bandW:70, box:{top:3,x0:30,x1:170}, accent:'#e0a23a', accentLabel:'band', hairMask:[[30,62],[44,69],[70,74],[100,75],[130,74],[156,69],[170,62]], front:(S,F,c,ctx,a)=>{
      const brim = ell(100,62+F.dy,70*F.sx,13);
      const cone = smooth(F.mp([[66,60,'s'],[76,38],[90,20],[110,7],[130,3,'s'],[120,14],[115,30],[126,50],[134,60,'s']]));
      const band = smooth(F.mp([[69,51,'s'],[131,51,'s'],[134,60,'s'],[66,60,'s']]));
      return shape(S,brim,c) + shape(S,cone,c) + shape(S,band,a,{noShade:true});
    }, shadow:[[46,66],[154,66],[150,80],[50,80]] },
  elfCap: { brimY:84, bandW:48, box:{top:20,x0:52,x1:166}, accent:c=>darken(c,.25), accentLabel:'band', hairMask:[[52,84],[76,78],[100,77],[124,78],[149,84]], front:(S,F,c,ctx,a)=>{
      // The tip folds over and hangs down close to the right side of the head, so the cap fits the canvas.
      const cap = smooth(F.mp([[52,82],[53,58],[63,40],[80,28],[100,22],[122,22],[140,30],[154,44],[162,60],[164,78,'s'],[155,66],[147,61],[148,80],[124,76],[100,75],[76,76]]));
      const fold = `<path d="M140,31 Q150,42 147,61" transform="translate(${n1((1-F.sx)*-100)},${F.dy}) scale(${n1(F.sx*1000)/1000},1)" fill="none" stroke="${darken(c,.3)}" stroke-width="1.4" opacity=".7"/>`;
      const band = smooth(F.mp([[52,84,'s'],[52,72],[76,66],[100,65],[124,66],[148,72],[149,84,'s'],[124,78],[100,77],[76,78]]));
      return shape(S,cap,c,{inner:fold}) + shape(S,band,a);
    }, shadow:[[52,84],[148,84],[148,94],[52,94]] },
  mushroom: { brimY:90, bandW:80, box:{top:4,x0:20,x1:180}, accent:'#fbf6ea', accentLabel:'spots', hairMask:[[22,78],[44,88],[100,91],[156,88],[178,78]], front:(S,F,c,ctx,a)=>{
      const cap = smooth(F.mp([[20,76],[24,50],[40,25],[68,9],[100,4],[132,9],[160,25],[176,50],[180,76],[150,82],[100,84],[50,82]]));
      const gills = smooth(F.mp([[32,78,'s'],[100,84],[168,78,'s'],[156,88],[100,91],[44,88]]));
      const spots = [[62,36,10],[100,20,11],[138,36,10],[36,62,6],[164,62,6],[82,60,7],[120,60,7]].map(([x,y,r])=>{const p=F.m([x,y]); return circ(p[0],p[1],r);}).join('');
      return shape(S,gills,'#efe1c2',{noShade:true}) + shape(S,cap,c,{inner:`<path d="${spots}" fill="${a}"/>`});
    }, shadow:[[40,86],[160,86],[156,96],[44,96]] },
  jester: { brimY:81, bandW:48, box:{top:15,x0:30,x1:163}, accent:'#f0453f', accentLabel:'middle point', hairMask:[[52,82],[76,78],[100,76],[124,78],[148,82]], front:(S,F,c,ctx,a)=>{
      // Asymmetric and compact: the left point droops beside the face, the middle one leans left,
      // the right one flops over to the side. Everything stays inside the canvas.
      const left  = smooth(F.mp([[58,72],[51,54],[42,45],[33,48],[31,62],[35,78],[39,90,'s'],[42,74],[47,65],[54,65],[61,78]]));
      const mid   = smooth(F.mp([[74,66],[76,46],[82,30],[90,20,'s'],[99,30],[110,46],[124,64]]));
      const right = smooth(F.mp([[118,66],[128,46],[143,35],[155,38],[161,50],[160,62],[156,73,'s'],[152,58],[146,51],[137,55],[145,70]]));
      const band  = smooth(F.mp([[52,82,'s'],[52,66],[100,61],[148,66],[148,82,'s'],[100,76]]));
      const bells = [[39,92],[89,18],[157,75]].map(p=>{const q=F.m(p); return shape(S,circ(q[0],q[1],5),'#f2c230',{noShade:true,k:.7});}).join('');
      return shape(S,left,c) + shape(S,right,c) + shape(S,mid,a) + shape(S,band,'#f2c230') + bells;
    }, shadow:[[52,84],[148,84],[148,92],[52,92]] },
  devilHorns: { box:{top:24,x0:59,x1:141,perch:.7}, front:(S,F,c,ctx)=>{
      const L = [[72,56],[63,42],[59,24,'s'],[71,36],[83,50]];
      const up = Math.max(ctx.lift*0.7, -20);
      return `<g transform="translate(0,${n1(up)})">` + shape(S,smooth(F.mp(L)),c) + shape(S,smooth(F.mp(mirrorPts(L))),c) + `</g>`;
    } },
  kippah: { box:{top:34,x0:77,x1:123,seat:1}, accent:c=>lighten(c,.55), accentLabel:'stripe', front:(S,F,c,ctx,a)=>{
      const k = smooth(F.mp([[77,47,'s'],[86,38],[100,34],[114,38],[123,47,'s'],[100,43]]));
      return `<g transform="translate(0,${n1(ctx.seat)})">` + shape(S,k,c,{inner:`<path d="M80,44 Q100,34 120,44" transform="translate(0,${F.dy})" fill="none" stroke="${a}" stroke-width="1.6"/>`}) + `</g>`;
    } },
  turban: { brimY:86, box:{top:26,x0:50,x1:150}, hideHairTop:true, front:(S,F,c)=>{
      const t = smooth(F.mp([[52,94],[50,66],[58,46],[74,32],[100,26],[126,32],[142,46],[150,66],[148,94],[138,88],[124,80],[100,84,'s'],[76,80],[62,88]]));
      const folds = ['M56,72 Q100,50 144,70','M61,55 Q100,38 139,53','M100,84 Q96,60 100,30'].map(s=>`<path d="${s}" transform="translate(0,${F.dy})" fill="none" stroke="${darken(c,.3)}" stroke-width="1.6" opacity=".75"/>`).join('');
      return shape(S,t,c,{inner:folds});
    }, shadow:[[56,92],[100,86],[144,92],[144,100],[100,96],[56,100]] },
  hijab: { glassesOver:true, hideHairTop:true, hideHairBack:true, hideEars:true,
    drape:(S,F,c)=> shape(S, smooth([[100,40],[140,48],[156,84],[157,128],[151,160],[170,178],[186,204],[14,204],[30,178],[49,160],[43,128],[44,84],[60,48]]), c),
    front:(S,F,c)=>{
      const outer = smooth([[100,36],[138,44],[155,80],[155,124],[141,158],[121,171],[100,175],[79,171],[59,158],[45,124],[45,80],[62,44]]);
      const inner = ell(100, F.cheekY+10, 37, 46);
      const id = uid('h');
      let s = `<clipPath id="${id}"><path d="${outer}${inner}" clip-rule="evenodd"/></clipPath>`;
      if (S.shade!=='none'){ s += `<g clip-path="url(#${id})"><path d="${outer}" fill="${darken(c,S.shade==='cel'?.3:.22)}"/><path d="${outer}" fill="${c}" transform="translate(-5,-4)"/><path d="${inner}" fill="${darken(c,.25)}" transform="translate(-2,3) scale(1.04)" transform-origin="100 ${F.cheekY+10}"/></g>`; }
      else s += `<path d="${outer}${inner}" fill="${c}" fill-rule="evenodd"/>`;
      if (S.sw>0) s += `<path d="${outer}${inner}" fill="none"${strokeAttr(S,c)}/>`;
      s += `<path d="M62,60 Q54,100 64,140" fill="none" stroke="${darken(c,.28)}" stroke-width="1.6" opacity=".7"/>`;
      return s;
    } },
  beanie: { brimY:85, bandW:48, box:{top:12,x0:52,x1:148}, accent:c=>lighten(c,.5), accentLabel:'pom-pom', hairMask:[[52,86],[76,82],[100,81],[124,82],[148,86]], front:(S,F,c,ctx,a)=>{
      const dome = smooth(F.mp([[54,82],[56,52],[72,32],[100,26],[128,32],[144,52],[146,82],[124,78],[100,77],[76,78]]));
      const band = smooth(F.mp([[52,86,'s'],[52,68],[100,63],[148,68],[148,86,'s'],[100,81]]));
      let ribs=''; for (let x=60;x<=140;x+=8) ribs += `<path d="M${x},${67+Math.abs(x-100)*0.08+F.dy} L${x},${82+F.dy}" stroke="${darken(c,.3)}" stroke-width="1.2" opacity=".6"/>`;
      return shape(S,circ(100,22+F.dy,10),a) + shape(S,dome,c) + shape(S,band,darken(c,.12),{inner:ribs});
    }, shadow:[[52,86],[148,86],[148,94],[52,94]] },
  partyHat: { box:{top:0,x0:80,x1:126}, accent:'#ffd23f', accentLabel:'pom-pom', front:(S,F,c,ctx,a)=>{
      const cone = smooth([[82,44,'s'],[100,4,'s'],[118,44,'s'],[100,48]]);
      const stripes = `<path d="M88,32 L112,26 M92,22 L108,18 M84,42 L116,36" stroke="#fff" stroke-width="3" opacity=".8"/>`;
      // On tall hair the hat perches on the side of the volume instead of poking out of the canvas.
      const tf = ctx.lift < -8 ? `translate(${n1(30*F.sx)},${n1(ctx.lift*0.55+8)}) rotate(34 100 46) translate(100 46) scale(.82) translate(-100 -46)` : `rotate(12 100 46) translate(0,${F.dy-2})`;
      return `<g transform="${tf}">` + shape(S,cone,c,{inner:stripes}) + shape(S,circ(100,6,6),a,{noShade:true,k:.7}) + `</g>`;
    } },
  hardHat: { brimY:93, bandW:62, box:{top:26,x0:38,x1:162}, accent:'#ffffff', accentLabel:'sticker', hairMask:[[38,88],[72,90],[100,89],[128,90],[162,88]], front:(S,F,c,ctx,a)=>{
      const crown = smooth(F.mp([[54,84],[55,60],[66,42],[84,32],[100,30],[116,32],[134,42],[145,60],[146,84],[124,79,'s'],[100,78],[76,79,'s']]));
      const bill = smooth(F.mp([[38,88,'s'],[60,79],[100,76],[140,79],[162,88,'s'],[156,96],[128,91],[100,90],[72,91],[44,96]]));
      const under = smooth(F.mp([[44,93,'s'],[72,89],[100,88],[128,89],[156,93,'s'],[128,93],[100,92],[72,93]]));
      const ridge = smooth(F.mp([[94,31,'s'],[106,31,'s'],[108,58],[107,78,'s'],[93,78,'s'],[92,58]]));
      const seam = `<path d="${ridge}" fill="${lighten(c,.22)}" stroke="${darken(c,.3)}" stroke-width="1"/>`, eyelets = '';
      const logo = shape(S, smooth(F.mp([[112,58,'s'],[124,60,'s'],[124,68,'s'],[112,66,'s']])), a, {noShade:true,k:.5});
      return shape(S,crown,c,{inner:seam+eyelets}) + logo + shape(S,bill,c) + `<path d="${under}" fill="${darken(c,.35)}"/>`;
    }, shadow:[[46,94],[100,90],[154,94],[150,104],[100,100],[50,104]] },
};

// ---------- features ----------
const EYES = {
  round:      {W:7.5, Ht:11,  Hb:10, yi:0.5, yo:0},
  almond:     {W:8.5, Ht:9,   Hb:6.5,yi:1,   yo:-1.5},
  monolid:    {W:8.6, Ht:6.6, Hb:6,  yi:1.5, yo:-1},
  downturned: {W:8,   Ht:9.5, Hb:8,  yi:-0.5,yo:2},
};
const BROWS = {
  thin:{th:2.2,arch:1.5,drop:0.5}, medium:{th:3.2,arch:1.5,drop:1}, thick:{th:4.6,arch:1,drop:1},
  bushy:{th:5.8,arch:0.5,drop:1.5}, arched:{th:3,arch:4.5,drop:2}, straight:{th:3.6,arch:-0.5,drop:-0.5},
};
const EXPR = {
  neutral:  {label:'Neutral',  mouth:'neutral'},
  happy:    {label:'Happy',    lower:2.2, brow:[-1.5,-2,-1], mouth:'smile', blush:.5},
  laughing: {label:'Laughing', closed:true, brow:[-3,-4,-2.5], mouth:'laugh', blush:.75},
  sincere:  {label:'Sincere',  lidTop:2.2, lower:1.2, brow:[-3,-1.5,.5], mouth:'soft', blush:.2},
  sad:      {label:'Sad',      lidTop:1, lidOuter:3.5, brow:[-4.5,-1.5,2.5], mouth:'frown'},
  crying:   {label:'Crying',   closed:'squeeze', brow:[-5.5,-2,3], mouth:'cryOpen', rivers:true, blush:.45},
  // emoji-style expressions
  lol:       {label:'LOL',        closed:true, brow:[-3,-4,-2.5], mouth:'laugh', blush:.8, joyTears:true},
  rofl:      {label:'ROFL',       closed:true, brow:[-3,-4,-2.5], mouth:'laugh', blush:.8, joyTears:true, tilt:-18},
  smileTear: {label:'Smile-cry',  lidTop:1.5, lower:2.2, brow:[-4,-1.5,1.5], mouth:'soft', blush:.4, tearSide:1},
  wink:      {label:'Wink',       winkSide:1, lower:1.5, brow:[-1.5,-2,-1], browR:[1,0,0], mouth:'smile', blush:.45},
  upsideDown:{label:'Upside down',lower:1.5, brow:[-1,-1.5,-.5], mouth:'smile', blush:.3, flip:true},
  shrug:     {label:'Shrug',      lidTop:2.8, browL:[-5,-4,-2], browR:[1,.5,0], mouth:'meh', hands:true},
  heartEyes: {label:'Heart eyes', eyeIcon:'heart', brow:[-2,-2.5,-1.5], mouth:'smile', blush:.6},
  starStruck:{label:'Star-struck',eyeIcon:'star', brow:[-4,-5,-3], mouth:'laugh', blush:.4},
  kiss:      {label:'Kiss',       winkSide:-1, closed:false, lower:1.5, brow:[-1.5,-2,-1], mouth:'kiss', blush:.6, heart:true},
  sleepy:    {label:'Sleepy',     closed:'sleep', brow:[1,1.5,1.5], mouth:'sleep', blush:.2, zzz:true},
  surprised:{label:'Surprised',wide:1.22, iris:.78, brow:[-6,-7,-5], mouth:'o'},
  angry:    {label:'Angry',    lidInner:5, brow:[5,1.5,-2.5], mouth:'grit'},
  zombie:   {label:'Zombie',   lidTop:2.5, iris:.72, browL:[3,1,-1], browR:[-3,-2.5,0], mouth:'zombie', zombie:true},
};
const CHEEKS = ['auto','none','light','medium','strong'];
const EYE_RENDER = ['auto','detailed','bean','flatIris','dot','beanLid','button'];
const EYE_RENDER_LABEL = {auto:'Style default', detailed:'#0 Detailed', bean:'#1 Solid bean', flatIris:'#2 White + flat iris', dot:'#3 Dot', beanLid:'#4 Bean + lid line', button:'#5 Glossy button'};
const EXPRESSIONS = ['neutral','happy','laughing','sincere','sad','crying','surprised','angry','lol','rofl','smileTear','wink','upsideDown','shrug','heartEyes','starStruck','kiss','sleepy'];
const VARIANTS = [...EXPRESSIONS.map(e=>({expression:e})), {transform:'zombie'}, {transform:'festive'}];
const variantLabel = v => v.transform ? v.transform[0].toUpperCase()+v.transform.slice(1) : EXPR[v.expression].label;

// Mii-style tuning. Integer steps; the renderer maps a step to pixels, degrees or a scale factor.
const TUNE = [
  {group:'Eyes', key:'eyes.spacing', label:'Spacing', min:-4, max:4, unit:1.6},
  {group:'Eyes', key:'eyes.y',       label:'Height',  min:-4, max:4, unit:1.6},
  {group:'Eyes', key:'eyes.size',    label:'Size',    min:-3, max:3, unit:0.08},
  {group:'Eyes', key:'eyes.tilt',    label:'Tilt',    min:-4, max:4, unit:4},
  {group:'Brows', key:'brows.spacing',label:'Spacing', min:-3, max:3, unit:1.4},
  {group:'Brows', key:'brows.y',      label:'Height',  min:-3, max:3, unit:1.5},
  {group:'Brows', key:'brows.tilt',   label:'Tilt',    min:-4, max:4, unit:4},
  {group:'Nose',  key:'nose.y',       label:'Height',  min:-3, max:3, unit:1.5},
  {group:'Nose',  key:'nose.size',    label:'Size',    min:-3, max:3, unit:0.1},
  {group:'Mouth', key:'mouth.y',      label:'Height',  min:-3, max:3, unit:1.5},
  {group:'Mouth', key:'mouth.size',   label:'Size',    min:-3, max:3, unit:0.09},
  // 'late' sliders were added after v1 codes existed; they are stored at the end of the code.
  {group:'Glasses', key:'glasses.y',  label:'Height',  min:-4, max:4, unit:1.5, late:true},
  {group:'Beard',   key:'beard.thickness', label:'Thickness', min:-2, max:4, unit:1, late:true},
  {group:'Beard',   key:'beard.length',    label:'Length',    min:-2, max:5, unit:1, late:true},
];
const getK = (o,k) => k.split('.').reduce((a,p)=>a==null?a:a[p], o);
const setK = (o,k,v) => { const ps=k.split('.'); let a=o; ps.slice(0,-1).forEach(p=>{a[p]=a[p]||{}; a=a[p];}); a[ps.at(-1)]=v; };
const tv = (t,k) => (getK(t,k)||0) * TUNE.find(x=>x.key===k).unit;

function eyePos(S,F,t,side){
  return { x: 100 + side*(S.eyeDX + tv(t,'eyes.spacing')), y: F.eyeY + S.eyeDY + tv(t,'eyes.y') };
}

function drawEye(S,t,F,ex,side,color,skin,ink,eyeMode){
  const base = EYES[t.eyes.shape];
  const sc = S.eye * (1 + tv(t,'eyes.size'));
  const tilt = -tv(t,'eyes.tilt');
  const p = eyePos(S,F,t,side);
  const tr = `translate(${n1(p.x)},${n1(p.y)}) scale(${side},1) rotate(${tilt}) scale(${n1(sc*100)/100})`;
  const lw = (S.sw ? Math.max(2, S.sw*0.8) : 2) / sc;
  if (ex.eyeIcon){
    const k = sc * 1.15, fill = ex.eyeIcon === 'heart' ? '#e5304f' : '#f2c230';
    const d = ex.eyeIcon === 'heart' ? 'M0,5 C-9,-1 -7,-9.5 0,-4.2 C7,-9.5 9,-1 0,5Z' : starD(9, 4);
    return `<g transform="translate(${n1(p.x)},${n1(p.y)}) scale(${n1(k*100)/100})"><path d="${d}" fill="${fill}" stroke="${ink}" stroke-width="${n1((S.sw ? S.sw*.55 : 1.2)/k)}" stroke-linejoin="round"/><circle cx="-2.6" cy="-2.2" r="1.3" fill="#fff" opacity=".85"/></g>`;
  }
  if (ex.closed || ex.winkSide === side){
    const cd = ex.closed==='squeeze' ? `M${n1(base.W*.85)},-4.2 L${n1(-base.W*.55)},0 L${n1(base.W*.85)},4.2` : ex.closed==='sleep' ? `M${-base.W},0.5 Q0,4.2 ${base.W},0.5` : ex.closed==='sad' ? `M${-base.W-0.5},-0.5 Q0,3 ${base.W+0.5},2.5` : `M${-base.W-0.5},2 Q0,-8.5 ${base.W+0.5},2`;
    return `<g transform="${tr}"><path d="${cd}" fill="none" stroke="${ink}" stroke-width="${n1(lw*1.25)}" stroke-linecap="round"/></g>`;
  }
  const wide = (ex.wide||1) * (S.anime ? 1.16 : 1), W=base.W;
  const Ht = Math.max(1.5, base.Ht*wide - (ex.lidTop||0)), Hb = Math.max(1.5, base.Hb*wide - (ex.lower||0));
  const top = `M${-W},${base.yi} C${n1(-W*.5)},${n1(-Ht+(ex.lidInner||0))} ${n1(W*.5)},${n1(-Ht+(ex.lidOuter||0))} ${W},${base.yo}`;
  const d = top + ` C${n1(W*.5)},${n1(Hb)} ${n1(-W*.5)},${n1(Hb)} ${-W},${base.yi}Z`;
  const id = uid('e');
  if (eyeMode && eyeMode!=='detailed'){
    const z = !!ex.zombie;
    const mcy = (Hb-Ht)*0.375, dark = z ? mix(color,'#e9e4c0',.6) : mix(color,'#140e14',.38);
    const hlx = n1(1.8*side), hlc = z ? 'none' : '#ffffff';
    let s = `<g transform="${tr}"><clipPath id="${id}"><path d="${d}"/></clipPath>`;
    if (z) s += `<path d="${ell(0,2,W+3,Hb+3)}" fill="${darken(skin,.35)}" opacity=".55"/>`;
    if (z && eyeMode==='dot'){ s += `<ellipse cx="0" cy="${n1(mcy+0.5)}" rx="2.7" ry="3" fill="#ece7c4" stroke="${ink}" stroke-width="1"/><circle cx="0" cy="${n1(mcy+0.5)}" r=".7" fill="${ink}"/>`; return s + `</g>`; }
    if (z && eyeMode==='flatIris'){ s += `<path d="${d}" fill="#ece7c4"/><g clip-path="url(#${id})"><circle cx="0.3" cy="${n1(mcy+0.6)}" r="3.6" fill="${mix(color,'#f4f1d8',.6)}"/><circle cx="0.3" cy="${n1(mcy+0.6)}" r="1" fill="#16121a"/></g>` + `<path d="${top}" fill="none" stroke="${ink}" stroke-width="${n1(lw*.85)}" stroke-linecap="round"/>`; return s + `</g>`; }
    const lidLine = (k=1, dy=0) => `<path d="${top}" fill="none" stroke="${ink}" stroke-width="${n1(lw*k)}" stroke-linecap="round" transform="translate(0,${dy})"/>`;
    const flicks = (k=1, dy=0) => (t.eyes.lashes && t.eyes.lashes!=='none') ? `<path d="M${W-0.5},${n1(base.yo-1.2+dy)} l3.4,-2.6${t.eyes.lashes==='long'?` M${n1(W*.5)},${n1(-Ht*.6+dy)} l2.4,-3.4`:''}" stroke="${ink}" stroke-width="${n1(lw*0.7*k)}" stroke-linecap="round"/>` : '';
    if (eyeMode==='bean'){
      s += `<g clip-path="url(#${id})"><ellipse cx="0" cy="${n1(mcy)}" rx="${n1(W*.62)}" ry="${n1((Ht+Hb)*.4)}" fill="${dark}"/></g>`;
      s += `<circle cx="${hlx}" cy="${n1(mcy-(Ht+Hb)*.16)}" r="1.6" fill="${hlc}"/>`;
    } else if (eyeMode==='flatIris'){
      s += `<path d="${d}" fill="#fbfaf7"/><g clip-path="url(#${id})"><circle cx="0.3" cy="${n1(mcy+0.6)}" r="4.6" fill="${color}"/></g>`;
      s += `<circle cx="${n1(0.3+1.6*side)}" cy="${n1(mcy-1.2)}" r="1.3" fill="${hlc}"/>` + lidLine(.85) + flicks();
    } else if (eyeMode==='dot'){
      const ry = Math.max(1.2, 3.6*Math.min(1,(Ht+Hb)/18));
      s += `<ellipse cx="0" cy="${n1(mcy+0.5)}" rx="2.7" ry="${n1(ry)}" fill="${mix(color,'#140e14',.6)}"/><circle cx="${n1(0.8*side)}" cy="${n1(mcy-ry*.35)}" r=".9" fill="${hlc}"/>`;
    } else if (eyeMode==='beanLid'){
      s += `<g clip-path="url(#${id})"><ellipse cx="0" cy="${n1(mcy+1)}" rx="${n1(W*.5)}" ry="${n1((Ht+Hb)*.36)}" fill="${dark}"/></g>`;
      s += `<circle cx="${hlx}" cy="${n1(mcy-(Ht+Hb)*.1)}" r="1.4" fill="${hlc}"/>` + lidLine(1.05,-0.6) + flicks(1,-0.6);
    } else if (eyeMode==='button'){
      const rx = W*.72, ry = (Ht+Hb)*.4;
      s += `<g clip-path="url(#${id})"><ellipse cx="0" cy="${n1(mcy)}" rx="${n1(rx)}" ry="${n1(ry)}" fill="${z ? dark : color}"/><ellipse cx="0" cy="${n1(mcy+0.4)}" rx="${n1(rx*(z?.18:.45))}" ry="${n1(ry*(z?.2:.5))}" fill="${mix(color,'#140e14',.65)}"/></g>`;
      if (S.sw) s += `<g clip-path="url(#${id})"><ellipse cx="0" cy="${n1(mcy)}" rx="${n1(rx)}" ry="${n1(ry)}" fill="none" stroke="${ink}" stroke-width="${n1(S.sw*.4/sc)}"/></g>`;
      s += `<circle cx="${hlx}" cy="${n1(mcy-ry*.4)}" r="1.5" fill="${hlc}"/><circle cx="${n1(-1.6*side)}" cy="${n1(mcy+ry*.4)}" r=".7" fill="${hlc}"/>` + lidLine(.9);
    }
    if (ex.tear || ex.tearSide === side) s += `<path d="M${W-1},${n1(Hb*0.7+2)} q3,6 0,8.5 q-3,-2.5 0,-8.5Z" fill="#7cc6f2" stroke="${ink}" stroke-width="${n1(Math.max(.8,S.sw*.3)/sc)}"/>`;
    return s + `</g>`;
  }
  const cy = n1((Hb-Ht)*0.375 + (S.chibi?0.2:S.anime?-0.2:0.6)), r = (S.chibi?5.6:S.anime?5.4:4.6)*(ex.iris||1);
  const rx = S.anime ? r*0.86 : r, ry = S.anime ? r*1.22 : r;
  const iris = ex.zombie ? mix(color,'#f4f1d8',.6) : color;
  let s = `<g transform="${tr}"><clipPath id="${id}"><path d="${d}"/></clipPath>`;
  if (ex.zombie) s += `<path d="${ell(0,2,W+3,Hb+3)}" fill="${darken(skin,.35)}" opacity=".55"/>`;
  s += `<path d="${d}" fill="${ex.zombie?'#ece7c4':'#fbfaf7'}"/>`;
  const irisD = ell(0.3, +cy, rx, ry);
  s += `<g clip-path="url(#${id})"><path d="${irisD}" fill="${iris}"/>`;
  if (S.anime && !ex.zombie){
    const ic = uid('i');
    s += `<clipPath id="${ic}"><path d="${irisD}"/></clipPath><g clip-path="url(#${ic})"><ellipse cx="0.3" cy="${n1(cy-ry*.55)}" rx="${n1(rx*1.1)}" ry="${n1(ry*.7)}" fill="${darken(iris,.5)}"/><ellipse cx="0.3" cy="${n1(+cy+ry*.62)}" rx="${n1(rx*.72)}" ry="${n1(ry*.45)}" fill="${lighten(iris,.42)}"/></g>`;
    s += `<path d="${irisD}" fill="none" stroke="${darken(iris,.55)}" stroke-width=".9"/>`;
    s += `<ellipse cx="0.3" cy="${n1(cy-0.4)}" rx="1.7" ry="2.8" fill="#16121a"/>`;
    s += `<ellipse cx="${n1(0.3-2.1*side)}" cy="${n1(cy-ry*.42)}" rx="1.9" ry="2.6" fill="#fff" transform="rotate(${-20*side} ${n1(0.3-2.1*side)} ${n1(cy-ry*.42)})"/><circle cx="${n1(0.3+2.2*side)}" cy="${n1(+cy+ry*.5)}" r=".95" fill="#fff"/>`;
  } else if (S.shade!=='none') s += `<path d="${irisD}" fill="none" stroke="${darken(iris,.35)}" stroke-width="1"/>`;
  if (S.anime && !ex.zombie){
  } else if (S.chibi && !ex.zombie){
    s += `<ellipse cx="0.3" cy="${n1(cy+1.6)}" rx="${n1(r*.78)}" ry="${n1(r*.7)}" fill="${lighten(iris,.28)}"/><path d="M${n1(-r+0.3)},${cy} A${n1(r)},${n1(r)} 0 0,1 ${n1(r+0.3)},${cy}" fill="${darken(iris,.35)}" opacity=".85"/>`;
    s += `<circle cx="0.3" cy="${n1(+cy+0.4)}" r="1.9" fill="#16121a"/><circle cx="${n1(0.3+1.9*side)}" cy="${n1(cy-2.2)}" r="1.9" fill="#fff"/><circle cx="${n1(0.3-2*side)}" cy="${n1(+cy+2.6)}" r=".9" fill="#fff"/>`;
  } else {
    s += `<circle cx="0.3" cy="${cy}" r="${ex.zombie?1.1:2.2}" fill="#16121a"/>`;
    if (!ex.zombie) s += `<circle cx="${n1(0.3+1.7*side)}" cy="${n1(cy-1.7)}" r="1.3" fill="#fff"/>`;
  }
  s += `<path d="${top}" fill="none" stroke="#2a1a2a" stroke-opacity=".14" stroke-width="3.2" transform="translate(0,1.2)"/></g>`;
  if (S.anime){
    const lash = '#2a1822';
    s += `<path d="${top}" fill="none" stroke="${lash}" stroke-width="${n1(2.9/sc)}" stroke-linecap="round"/>`;
    s += `<path d="M${n1(W*.55)},${n1(base.yo-Ht*.32)} Q${n1(W+1.5)},${n1(base.yo-1)} ${n1(W+3.6)},${n1(base.yo-3.4)} Q${n1(W+1)},${n1(base.yo+0.6)} ${W},${n1(base.yo+0.8)}Z" fill="${lash}"/>`;
    s += `<path d="M${n1(W*.15)},${n1(Hb*.74)} Q${n1(W*.62)},${n1(Hb*.7)} ${n1(W*.92)},${n1(base.yo+Hb*.38)}" fill="none" stroke="${ink}" stroke-width="${n1(1/sc)}" stroke-linecap="round"/>`;
  } else {
    if (S.sw>0) s += `<path d="${d}" fill="none" stroke="${ink}" stroke-width="${n1(S.sw*0.42/sc)}" stroke-linejoin="round"/>`;
    s += `<path d="${top}" fill="none" stroke="${ink}" stroke-width="${n1(lw)}" stroke-linecap="round"/>`;
  }
  if (t.eyes.lashes && t.eyes.lashes!=='none'){
    const fl = t.eyes.lashes==='long' ? [[W-0.5,base.yo-1.6,4.2,-3],[W*0.55,-Ht*0.62,3.2,-4],[W*0.1,-Ht*0.75,1.6,-4.4]] : [[W-0.5,base.yo-1.2,3.2,-2.4]];
    fl.forEach(([x,y,dx,dy]) => s += `<path d="M${n1(x)},${n1(y)} l${dx},${dy}" stroke="${ink}" stroke-width="${n1(lw*0.75)}" stroke-linecap="round"/>`);
  }
  if (ex.tear || ex.tearSide === side) s += `<path d="M${W-1},${n1(Hb*0.7+2)} q3,6 0,8.5 q-3,-2.5 0,-8.5Z" fill="#7cc6f2" stroke="${ink}" stroke-width="${n1(Math.max(.8,S.sw*.3)/sc)}"/>`;
  return s + `</g>`;
}

// Nose bottom and mouth centre; the mouth always keeps a small gap below the nose.
function noseBottomY(S,t,F){ return F.noseY + tv(t,'nose.y') + (S.noseDY||0) + 4.5*(1+tv(t,'nose.size'))*(S.noseScale||1); }
const MOUSTACHES = ['mustache','goatee','circle','handlebar','pencil','muttonChops','full','short','long'];
function mouthCenterY(S,t,F){
  const y = F.mouthY + tv(t,'mouth.y') + (S.mouthDY||0);
  const gap = MOUSTACHES.includes(t.facialHair) ? 9 + S.sw*1.2 : 4.5*(S.mouthScale||1);   // leave room for a moustache
  return Math.min(Math.max(y, noseBottomY(S,t,F) + gap), F.chinY - 8*(S.mouthScale||1));
}

function drawRivers(S,t,F,side){
  const base = EYES[t.eyes.shape], sc = S.eye * (1 + tv(t,'eyes.size'));
  const p = eyePos(S,F,t,side);
  const xc = p.x + side*base.W*sc*0.38, y0 = p.y + 1.5*sc, yb = F.chinY - 6;
  const L = [], R = [], N = 6;
  for (let k=0;k<=N;k++){
    const u = k/N, y = y0 + (yb-y0)*u, hw = (3.6 + 2.6*u)*Math.min(sc,1.35);
    const wob = (k%2 ? 2.4 : -2) * (k?1:0.3);
    L.push([xc - hw + wob, y]); R.push([xc + hw + wob*0.8, y]);
  }
  const bot = [[xc+7, yb+3],[xc, yb+9],[xc-7, yb+3]];
  const pts = [[L[0][0],L[0][1],'s'], ...L.slice(1), ...bot, ...R.slice(1).reverse(), [R[0][0],R[0][1],'s']];
  const d = smooth(pts);
  const edge = S.sw ? lineFor(S,'#9fd6f2') && (S.tinted ? '#4f9bc8' : S.line) : '#5aa9d6';
  let s = `<path d="${d}" fill="#a9dcf5" fill-opacity=".92" stroke="${edge}" stroke-width="${n1(S.sw ? Math.max(1.3,S.sw*.5) : 1.2)}" stroke-linejoin="round"/>`;
  s += `<path d="M${n1(xc-1)},${n1(y0+6)} Q${n1(xc+1.2)},${n1((y0+yb)/2)} ${n1(xc-0.6)},${n1(yb-2)}" fill="none" stroke="#ffffff" stroke-opacity=".8" stroke-width="1.6" stroke-linecap="round"/>`;
  return s;
}

// Neutral brow placement relative to the eye centre, pushed up if a slider would drop it into the eye.
function browGeom(S,t,F){
  const b = BROWS[t.brows.type], base = EYES[t.eyes.shape];
  const bsc = 1 + (S.eye-1)*0.6, esc = S.eye * (1 + tv(t,'eyes.size'));
  const sizeLift = tv(t,'eyes.size')*8, th = b.th*(S.browK||1);
  const ys = [-13-sizeLift, -14.5-b.arch-sizeLift, -12+b.drop-sizeLift];
  const tiltDrop = Math.abs(tv(t,'brows.tilt'))*Math.PI/180*(base.W+3.5)*bsc;
  const bottom = (Math.max(...ys) + th/2) * bsc + tv(t,'brows.y') + tiltDrop;
  const eyeTop = -base.Ht * (S.anime ? 1.16 : 1) * 0.75 * esc - Math.abs(tv(t,'eyes.tilt'))*Math.PI/180*base.W*esc;
  const push = Math.max(0, bottom - (eyeTop - (S.anime ? 4 : 2)));
  const top = (Math.min(...ys) - th/2) * bsc + tv(t,'brows.y') - push;
  return { push, top };   // top: brow top edge relative to the eye centre
}
function browTopY(S,t,F){ return eyePos(S,F,t,1).y + browGeom(S,t,F).top; }

function drawBrow(S,t,F,ex,side,color){
  const b = BROWS[t.brows.type], base = EYES[t.eyes.shape];
  const off = (side===1 ? ex.browR : ex.browL) || ex.brow || [0,0,0];
  const sc = 1 + (S.eye-1)*0.6;
  const p = eyePos(S,F,t,side);
  const dx = tv(t,'brows.spacing'), dyy = tv(t,'brows.y') - browGeom(S,t,F).push, tilt = -tv(t,'brows.tilt');
  const sizeLift = tv(t,'eyes.size')*8;
  const W = base.W;
  const P0=[-(W+2), -13+off[0]-sizeLift], P1=[1, -14.5-b.arch+off[1]-sizeLift], P2=[W+3.5, -12+off[2]+b.drop-sizeLift];
  const C=[2*P1[0]-(P0[0]+P2[0])/2, 2*P1[1]-(P0[1]+P2[1])/2];
  const topS=[], botS=[];
  for (let i=0;i<=10;i++){
    const u=i/10, a=(1-u)*(1-u), bb=2*(1-u)*u, c=u*u;
    const x=a*P0[0]+bb*C[0]+c*P2[0], y=a*P0[1]+bb*C[1]+c*P2[1];
    const tx=2*(1-u)*(C[0]-P0[0])+2*u*(P2[0]-C[0]), ty=2*(1-u)*(C[1]-P0[1])+2*u*(P2[1]-C[1]);
    const L=Math.hypot(tx,ty)||1, nx=-ty/L, ny=tx/L;
    const h=b.th*(S.browK||1)/2*(1-0.55*u) + 0.25;
    topS.push([x+nx*h,y+ny*h]); botS.push([x-nx*h,y-ny*h]);
  }
  const pts=[...topS,...botS.reverse()];
  const d='M'+pts.map(q=>`${n1(q[0])},${n1(q[1])}`).join('L')+'Z';
  return `<path d="${d}" fill="${color}" stroke="${color}" stroke-width=".8" stroke-linejoin="round" transform="translate(${n1(p.x+side*dx)},${n1(p.y+dyy)}) scale(${side*sc},${sc}) rotate(${tilt})"/>`;
}

function starD(R,r){
  let d=''; for (let i=0;i<10;i++){ const a=-Math.PI/2+i*Math.PI/5, q=i%2?r:R; d += (i?'L':'M')+n1(q*Math.cos(a))+','+n1(q*Math.sin(a)+1.5); }
  return d+'Z';
}
const NOSES = {
  button:  ['M-4,2 Q0,5.5 4,2', 'M-2.5,0.5 l0.1,0.1 M2.5,0.5 l0.1,0.1'],
  broad:   ['M-8.5,-1 Q-10,4.5 -4.5,4.5 Q0,6.5 4.5,4.5 Q10,4.5 8.5,-1'],
  straight:['M2,-17 Q4.5,-5 4.2,1 Q1,5 -3.2,3.2'],
  pointed: ['M0.5,-19 Q8,-4 5.5,2 Q1.5,5.4 -3.2,3.2'],
  small:   ['M-2.8,2 Q0,3.8 2.8,2'],
  anime:   ['M2.4,-3 Q3.6,0.5 1.2,2.4'],
};
function drawNose(S,t,F,skin){
  const type = S.noseMode==='anime' ? 'anime' : (S.noseSmall ? 'small' : t.nose.type);
  const sc = (1 + tv(t,'nose.size')) * (S.noseScale||1);
  const y = F.noseY + tv(t,'nose.y') + (S.noseDY||0);
  const col = darken(skin, S.sw ? .42 : .28);
  const w = S.sw ? Math.max(1.8, S.sw*0.62) : 2.4;
  let s = `<g transform="translate(100,${n1(y)}) scale(${n1(sc*100)/100})">`;
  if (S.shade==='cel' && type!=='small' && type!=='anime') s += `<ellipse cx="4" cy="-3" rx="3" ry="6" fill="${darken(skin,.14)}"/>`;
  NOSES[type].forEach(d => s += `<path d="${d}" fill="none" stroke="${col}" stroke-width="${n1(w/sc)}" stroke-linecap="round" stroke-linejoin="round"/>`);
  return s + `</g>`;
}

// Half widths of the crying mouths: about a third of the face width, as in chibi/anime crying faces.
const CRYW = { cryPill: w => Math.max(w*1.9, 15), cryOval: w => Math.max(w*1.5, 12), cryOpen: w => Math.max(w*1.75, 14) };
function drawMouth(S,t,F,ex,skin,ink,zombie){
  const base = {small:6.5, medium:8.5, wide:11}[t.mouth.width] * F.sx;
  let sc = (1 + tv(t,'mouth.size')) * (S.mouthScale||1);
  // Crying mouths are big in every style (they carry the expression): no per-style mouth shrink.
  if (/^cry/.test(ex.mouth)) sc = Math.max(1, 1 + tv(t,'mouth.size'));
  const w = base;
  let y = mouthCenterY(S,t,F), syK = 1;
  // Fit the mouth between nose and chin using its real extent (open mouths are tall): move it up first,
  // then shrink it if it still doesn't fit. Wide mouths keep extra distance where the chin curves away.
  {
    const cw = CRYW.cryPill(w), ow = CRYW.cryOval(w), pw = CRYW.cryOpen(w);
    const EXT = { cryPill:[cw*.4, cw*.36], cryOval:[ow*.53, ow*.53], cryOpen:[pw*.6, pw*.6], wail2:[2,7.5], wail3:[4.5,13], wail4:[1,4], wail5:[2,11.5], wail6:[1,7],
      neutral:[1,2.5], smile:[3,6], soft:[1,3.5], frown:[4,3.5], o:[4,6.5], laugh:[2.5,13.5], grit:[2.5,6.5], zombie:[2,10], wail:[5.5,17], kiss:[4,4.5], sleep:[2,5], meh:[2,2] }[ex.mouth] || [2,6];
    const half = (/^wail[35]?$/.test(ex.mouth) ? Math.max(w,7.5)*1.2 : /^cry/.test(ex.mouth) ? CRYW[ex.mouth](w) : w + 2) * sc;
    const bottomMax = F.chinY - 3 - Math.max(0, half - F.chinW) * 0.32;
    const topMin = noseBottomY(S,t,F) + (/^cry/.test(ex.mouth) ? -1 : 2);
    if (y + EXT[1]*sc > bottomMax) y = bottomMax - EXT[1]*sc;
    if (y - EXT[0]*sc < topMin && /^cry/.test(ex.mouth)){
      // Crying mouths keep their width and get flatter instead (the references are wide mouths).
      const room = bottomMax - topMin;
      syK = Math.max(.55, Math.min(1, room / ((EXT[0] + EXT[1]) * sc)));
      if ((EXT[0] + EXT[1]) * sc * syK > room) sc = room / ((EXT[0] + EXT[1]) * syK);   // still too tall: shrink too
      y = topMin + EXT[0]*sc*syK;
    } else if (y - EXT[0]*sc < topMin){
      const room = bottomMax - topMin;
      sc = Math.max(.55, Math.min(sc, room / (EXT[0] + EXT[1])));
      y = Math.min(topMin + EXT[0]*sc, bottomMax - EXT[1]*sc);
    }
  }
  const mc = mix(darken(skin,.62),'#5a1424',.4), lc = mix(skin,'#b8475a',.38);
  const lw = n1(Math.max(2.1, S.sw*0.78)/sc);
  const line = (d) => `<path d="${d}" fill="none" stroke="${S.sw?ink:mc}" stroke-width="${lw}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const lip = (y0) => {
    if (t.mouth.lips==='full') return `<path d="M${n1(-w*.62)},${y0+1.4} Q0,${y0+7.5} ${n1(w*.62)},${y0+1.4} Q0,${y0+3.2} ${n1(-w*.62)},${y0+1.4}Z" fill="${lc}"/>`;
    if (t.mouth.lips==='medium') return `<path d="M-3,${y0+4.4} Q0,${y0+5.6} 3,${y0+4.4}" fill="none" stroke="${darken(skin,.25)}" stroke-width="1.3" stroke-linecap="round" opacity=".7"/>`;
    return '';
  };
  let s = `<g transform="translate(100,${n1(y)}) scale(${n1(sc*100)/100},${n1(sc*syK*100)/100})">`;
  const outl = S.sw ? ` stroke="${ink}" stroke-width="${lw}" stroke-linejoin="round"` : '';
  switch(ex.mouth){
    case 'neutral': s += lip(.7) + line(`M${n1(-w)},0 Q0,1.4 ${n1(w)},0`); break;
    case 'kiss':    s += `<path d="M${n1(-1.2)},-3.6 q4,1 .8,3.4 q4,1.6 -.6,3.8" fill="${lc}" stroke="${S.sw?ink:mc}" stroke-width="${lw}" stroke-linecap="round" stroke-linejoin="round"/>`; break;
    case 'sleep':   s += `<ellipse cx="0" cy="1.5" rx="2.6" ry="3.2" fill="#5a1a24"${outl}/>`; break;
    case 'wail2': {   // small wobbly open mouth, light inside
      const W = Math.max(w*.7, 5.5);
      const d = `M${n1(-W)},1 Q${n1(-W*.6)},-2 ${n1(-W*.25)},0 Q0,1.6 ${n1(W*.25)},0 Q${n1(W*.6)},-2 ${n1(W)},1 Q${n1(W*.9)},6.5 ${n1(W*.45)},6 Q0,7.6 ${n1(-W*.45)},6 Q${n1(-W*.9)},6.5 ${n1(-W)},1Z`;
      s += `<path d="${d}" fill="#e2707f" stroke="${S.sw?ink:mc}" stroke-width="${S.sw?lw:1.4}" stroke-linejoin="round"/><path d="M${n1(-W*.4)},4.6 Q0,6.6 ${n1(W*.4)},4.6" fill="none" stroke="#f3a3ad" stroke-width="1.6" stroke-linecap="round"/>`; break; }
    case 'wail3': {   // big round bawl (WAAH)
      const W = Math.max(w, 7.5)*1.05, id = uid('m');
      const d = `M0,-4.5 C${n1(W*1.15)},-4.5 ${n1(W*1.05)},13 0,13 C${n1(-W*1.05)},13 ${n1(-W*1.15)},-4.5 0,-4.5Z`;
      s += `<clipPath id="${id}"><path d="${d}"/></clipPath><path d="${d}" fill="#b83b4f"/><g clip-path="url(#${id})"><ellipse cx="0" cy="12" rx="${n1(W*.6)}" ry="5" fill="#ee8d98"/></g><path d="${d}" fill="none" stroke="${S.sw?ink:mc}" stroke-width="${S.sw?lw:1.4}"/>`; break; }
    case 'wail4':     // closed, quivering frown
      s += line(`M${n1(-w-1)},4 L${n1(-w*.6)},.6 L${n1(-w*.2)},2.6 L${n1(w*.2)},.4 L${n1(w*.6)},2.6 L${n1(w+1)},4`); break;
    case 'wail5': {   // wide open, dark inside, jagged upper teeth
      const W = Math.max(w, 7.5)*1.2, id = uid('m');
      const d = `M${n1(-W)},-1.5 L${n1(W)},-1.5 Q${n1(W*.95)},10 0,11.5 Q${n1(-W*.95)},10 ${n1(-W)},-1.5Z`;
      let teeth = `M${n1(-W)},-1.5`; for (let i = 0; i <= 6; i++) teeth += ` L${n1(-W + (i+.5)*W/3.5)},${i%2 ? '-1.5' : '1.8'}`;
      s += `<clipPath id="${id}"><path d="${d}"/></clipPath><path d="${d}" fill="#3e1219"/><g clip-path="url(#${id})"><path d="${teeth} L${n1(W)},-1.5 L${n1(W)},-4 L${n1(-W)},-4Z" fill="#fbfaf7"/><ellipse cx="0" cy="11" rx="${n1(W*.5)}" ry="4" fill="#d9707c"/></g><path d="${d}" fill="none" stroke="${S.sw?ink:mc}" stroke-width="${S.sw?lw:1.4}" stroke-linejoin="round"/>`; break; }
    case 'wail6':     // pout: frown with a pushed-out lower lip
      s += `<path d="M${n1(-w*.75)},3.2 Q0,-2.4 ${n1(w*.75)},3.2 Q0,7.2 ${n1(-w*.75)},3.2Z" fill="${lc}"${outl || ` stroke="${mc}" stroke-width="1.2"`}/>` + line(`M${n1(-w*.75)},3.2 Q0,-2.4 ${n1(w*.75)},3.2`); break;
    // Crying mouths modelled on the references: big, light pink inside, one outline, wobbly edges.
    case 'cryPill': {  // ref 1: wide pill, wobbly top and bottom, white upper teeth
      const W = CRYW.cryPill(w), H = W*.62, id = uid('m');
      const d = `M${n1(-W)},${n1(-H*.15)} Q${n1(-W*.8)},${n1(-H*.62)} ${n1(-W*.45)},${n1(-H*.45)} Q${n1(-W*.15)},${n1(-H*.3)} 0,${n1(-H*.55)} Q${n1(W*.22)},${n1(-H*.75)} ${n1(W*.5)},${n1(-H*.5)} Q${n1(W*.85)},${n1(-H*.6)} ${n1(W)},${n1(-H*.1)} Q${n1(W*1.08)},${n1(H*.45)} ${n1(W*.62)},${n1(H*.48)} Q${n1(W*.3)},${n1(H*.3)} 0,${n1(H*.48)} Q${n1(-W*.32)},${n1(H*.62)} ${n1(-W*.66)},${n1(H*.45)} Q${n1(-W*1.08)},${n1(H*.4)} ${n1(-W)},${n1(-H*.15)}Z`;
      s += `<clipPath id="${id}"><path d="${d}"/></clipPath><path d="${d}" fill="#f2909a"/><g clip-path="url(#${id})"><path d="M${n1(-W)},${n1(-H*.32)} Q0,${n1(-H*.2)} ${n1(W)},${n1(-H*.32)} L${n1(W)},${n1(-H)} L${n1(-W)},${n1(-H)}Z" fill="#fbfaf7"/><ellipse cx="0" cy="${n1(H*.42)}" rx="${n1(W*.55)}" ry="${n1(H*.22)}" fill="#e46f7c"/></g><path d="${d}" fill="none" stroke="${S.sw?ink:mc}" stroke-width="${S.sw?lw:1.5}" stroke-linejoin="round"/>`; break; }
    case 'cryOval': {  // ref 3: big rounded open mouth
      const W = CRYW.cryOval(w), H = W*1.05, id = uid('m');
      const d = `M0,${n1(-H*.5)} C${n1(W*1.05)},${n1(-H*.52)} ${n1(W*.95)},${n1(H*.5)} 0,${n1(H*.5)} C${n1(-W*.95)},${n1(H*.5)} ${n1(-W*1.05)},${n1(-H*.52)} 0,${n1(-H*.5)}Z`;
      s += `<clipPath id="${id}"><path d="${d}"/></clipPath><path d="${d}" fill="#e97d88"/><g clip-path="url(#${id})"><ellipse cx="0" cy="${n1(H*.42)}" rx="${n1(W*.62)}" ry="${n1(H*.25)}" fill="#d9606f"/></g><path d="${d}" fill="none" stroke="${S.sw?ink:mc}" stroke-width="${S.sw?lw:1.5}"/>`; break; }
    case 'cryOpen': {  // ref 2: big open mouth with a wobbly outline, wider at the bottom
      const W = CRYW.cryOpen(w), H = W*.95, id = uid('m');
      const d = `M${n1(-W*.8)},${n1(-H*.42)} Q${n1(-W*.45)},${n1(-H*.62)} ${n1(-W*.1)},${n1(-H*.44)} Q${n1(W*.25)},${n1(-H*.62)} ${n1(W*.75)},${n1(-H*.45)} Q${n1(W*1.1)},${n1(-H*.05)} ${n1(W*.95)},${n1(H*.25)} Q${n1(W*.75)},${n1(H*.55)} ${n1(W*.3)},${n1(H*.48)} Q0,${n1(H*.62)} ${n1(-W*.35)},${n1(H*.5)} Q${n1(-W*.85)},${n1(H*.55)} ${n1(-W*1)},${n1(H*.15)} Q${n1(-W*1.1)},${n1(-H*.15)} ${n1(-W*.8)},${n1(-H*.42)}Z`;
      s += `<clipPath id="${id}"><path d="${d}"/></clipPath><path d="${d}" fill="#d96474"/><g clip-path="url(#${id})"><ellipse cx="0" cy="${n1(H*.45)}" rx="${n1(W*.6)}" ry="${n1(H*.26)}" fill="#ef95a0"/></g><path d="${d}" fill="none" stroke="${S.sw?ink:mc}" stroke-width="${S.sw?lw:1.5}" stroke-linejoin="round"/>`; break; }
    case 'meh':     s += line(`M${n1(-w*.9)},1.2 Q${n1(-w*.2)},1.6 ${n1(w*.9)},-1.8`); break;
    case 'smile':   s += lip(2.8) + line(`M${n1(-w-1.5)},-2.5 Q0,8 ${n1(w+1.5)},-2.5`); break;
    case 'soft':    s += lip(1.3) + line(`M${n1(-w*.85)},-0.5 Q0,3.2 ${n1(w*.85)},-0.5`); break;
    case 'frown':   s += lip(-0.6) + line(`M${n1(-w)},3 Q0,-3.6 ${n1(w)},3`); break;
    case 'wail': {
      // Bawling mouth (as in chibi/anime crying): big, open, wider at the bottom, wobbly upper lip,
      // pink-red inside with a top teeth strip and a lighter tongue.
      const W = Math.max(w, 7.5) * 1.18, k = 1.35, y = v => n1(v * k);
      const top = `M${n1(-W)},${y(.5)} Q${n1(-W*.78)},${y(-3)} ${n1(-W*.52)},${y(-.6)} Q${n1(-W*.27)},${y(1.5)} 0,${y(-1.2)} Q${n1(W*.27)},${y(-3.8)} ${n1(W*.52)},${y(-.8)} Q${n1(W*.78)},${y(1.7)} ${n1(W)},0`;
      const d = top + ` Q${n1(W*1.22)},${y(5)} ${n1(W*.86)},${y(9.2)} Q${n1(W*.42)},${y(11.8)} 0,${y(11)} Q${n1(-W*.44)},${y(12.2)} ${n1(-W*.86)},${y(9.4)} Q${n1(-W*1.24)},${y(5.2)} ${n1(-W)},${y(.5)}Z`;
      const id = uid('m');
      s += `<clipPath id="${id}"><path d="${d}"/></clipPath><path d="${d}" fill="#c64a5e"/>`;
      s += `<g clip-path="url(#${id})"><path d="${top}" fill="none" stroke="#fbfaf7" stroke-width="5" transform="translate(0,-0.8)"/><ellipse cx="0" cy="${y(11)}" rx="${n1(W*.62)}" ry="${y(4.4)}" fill="#ee8d98"/></g>`;
      s += `<path d="${d}" fill="none" stroke="${S.sw?ink:mc}" stroke-width="${S.sw?lw:1.4}" stroke-linejoin="round" stroke-linecap="round"/>`; break; }
    case 'o':       s += `<ellipse cx="0" cy="1.5" rx="3.8" ry="5" fill="#5a1a24"${outl}/>`; break;
    case 'laugh': {
      const d = `M${n1(-w-2)},-2 Q0,0.5 ${n1(w+2)},-2 Q${n1(w*.8)},13 0,13 Q${n1(-w*.8)},13 ${n1(-w-2)},-2Z`, id=uid('m');
      s += `<clipPath id="${id}"><path d="${d}"/></clipPath><path d="${d}" fill="#5a1a24"/><g clip-path="url(#${id})"><rect x="${n1(-w-2)}" y="-4" width="${n1(2*w+4)}" height="6" fill="#fff"/><ellipse cx="0" cy="12" rx="${n1(w*.62)}" ry="5" fill="#e0707a"/></g>`;
      s += `<path d="${d}" fill="none" stroke="${S.sw?ink:mc}" stroke-width="${S.sw?lw:1.4}" stroke-linejoin="round"/>`; break; }
    case 'grit': {
      const d = `M${n1(-w)},0 Q0,-2.4 ${n1(w)},0 L${n1(w*.9)},5.5 Q0,4.2 ${n1(-w*.9)},5.5Z`;
      s += `<path d="${d}" fill="#fbfaf7" stroke="${S.sw?ink:mc}" stroke-width="${S.sw?lw:1.4}" stroke-linejoin="round"/><path d="M${n1(-w*.95)},2.6 Q0,1.4 ${n1(w*.95)},2.6" fill="none" stroke="${S.sw?ink:mc}" stroke-width="1"/>`; break; }
    case 'zombie': {
      const d = `M${n1(-w-1)},1 L${n1(-w*.4)},-1.5 L0,0.8 L${n1(w*.5)},-1.8 L${n1(w+1)},2.2 Q${n1(w*.6)},9.5 0,8.4 Q${n1(-w*.7)},9.6 ${n1(-w-1)},1Z`;
      s += `<path d="${d}" fill="#3b1c22"${outl || ` stroke="${mc}" stroke-width="1.2"`}/><rect x="-4" y="-0.5" width="3.6" height="3.8" rx=".6" fill="#f2ecd2"/>`; break; }
  }
  return s + `</g>`;
}

function drawGlasses(S,t,F,zombie,part){
  const g = t.glasses; if (!g || g.type==='none') return '';
  const out = (back, front) => part==='back' ? back : part==='front' ? front : back + front;
  const gs = (S.eye>1 ? 1+(S.eye-1)*0.55 : 1) * (1 + tv(t,'eyes.size')*0.5);
  const gy = tv(t,'glasses.y');
  const P = eyePos(S,F,t,1), PL = eyePos(S,F,t,-1);
  P.y += gy; PL.y += gy;
  const frame = g.frame, fw = S.sw ? Math.max(2.4, S.sw*0.85) : 2.6;
  const LENS = {
    round:  {d:circ(0,0,11.5), inX:-11.5, outX:11.5, by:-2, ty:-3},
    rect:   {d:'M-13,-8 H12 Q14,-8 14,-6 V5 Q14,9 10,9 H-10 Q-13,9 -13,6Z', inX:-13, outX:14, by:-3, ty:-5},
    cateye: {d:'M-12,-6 Q-2,-9.5 15,-12.5 Q14.5,4 9,8 Q0,11 -8,8 Q-13,5 -12,-6Z', inX:-12, outX:15, by:-4, ty:-9},
    aviator:{d:'M-11,-8 L12,-8 Q15.5,-7 13.5,2 Q10.5,12 1,11 Q-10,10 -11,0Z', inX:-11, outX:13.5, by:-6, ty:-7},
    half:   {d:'M-12,1.5 L12,1.5 L11,8.5 Q8,11.5 0,11.5 Q-8,11.5 -11,8.5Z', inX:-12, outX:12, by:2.5, ty:2},
    monocle:{d:circ(0,0,12), inX:-12, outX:12, by:0, ty:0},
    oval:     {d:ell(0,0,13,9.5), inX:-13, outX:13, by:-2, ty:-3},
    wayfarer: {d:'M-13,-9 L14,-10.5 Q15.5,-10.5 15,-7 L12.5,6.5 Q11.5,9.5 8,9.5 L-9,9.5 Q-12,9.5 -12.5,6.5 L-13.8,-6 Q-14,-9 -13,-9Z', inX:-13.5, outX:15, by:-6, ty:-8, fwK:1.45},
    browline: {d:'M-12,-8 H12 Q14.5,-8 14,-4.5 Q13,7 6,9 Q0,10 -6,9 Q-13,7 -12.5,-4.5Z', inX:-12.5, outX:14, by:-6, ty:-6, bar:'M-12.8,-7 Q0,-10.5 14.8,-7.5', rimK:.5},
    hexagon:  {d:'M-12.5,0 L-6.5,-10 L7,-10 L13,0 L7,10 L-6.5,10Z', inX:-12.5, outX:13, by:-3, ty:-4},
    rimless:  {d:'M-12,-7 Q0,-9 13,-7 Q14,4 9,8 Q0,10 -9,8 Q-13,4 -12,-7Z', inX:-12, outX:13, by:-5, ty:-6, rimK:.3},
    oversized:{d:ell(0,1.5,15.5,14), inX:-15.5, outX:15.5, by:-3, ty:-5},
    heart:    {d:'M0,10.5 C-15,0 -14.5,-12.5 -6.5,-11.5 C-3,-11 -1,-8.5 0,-6.5 C1,-8.5 3,-11 6.5,-11.5 C14.5,-12.5 15,0 0,10.5Z', inX:-13, outX:13.5, by:-5, ty:-6},
    star:     {d:starD(14,6.4), inX:-12.5, outX:12.5, by:-3, ty:-4},
    shield:   {single:true, d:'M-35,-9.5 Q0,-13 35,-9.5 Q37,6 27,10.5 Q14,12.5 4.5,6 Q0,4 -4.5,6 Q-14,12.5 -27,10.5 Q-37,6 -35,-9.5Z', outX:35, ty:-7},
    pinceNez: {d:ell(0,0,10.5,9), inX:-10.5, outX:10.5, by:-1, ty:0, noTemples:true, chain:true},
    square:     {d:'M-12,-9.5 H13 Q14,-9.5 14,-8.5 V8 Q14,9.5 12.5,9.5 H-11.5 Q-13,9.5 -13,8 V-8.5 Q-13,-9.5 -12,-9.5Z', inX:-13, outX:14, by:-5, ty:-6, fwK:1.25},
    softSquare: {d:'M-8,-9.5 H9 Q14,-9.5 14,-4.5 V4.5 Q14,9.5 9,9.5 H-8 Q-13,9.5 -13,4.5 V-4.5 Q-13,-9.5 -8,-9.5Z', inX:-13, outX:14, by:-4, ty:-5},
    panto:      {d:'M-12,-7.5 Q0,-9.5 13,-7.5 Q15.5,3 9.5,8.5 Q1,12.5 -7,9 Q-13.5,4 -12,-7.5Z', inX:-12.5, outX:14, by:-4, ty:-6},
    narrow:     {d:'M-13,-5.5 H13 Q15,-5.5 14.5,-2.5 L13.5,3.5 Q13,6 10,6 H-10 Q-13,6 -13,3.5Z', inX:-13, outX:14.5, by:-3, ty:-4},
    semiRim:    {d:'M-13,-7.5 H13 Q14.5,-7.5 14,-4 Q13,7 6,8.5 Q0,9.5 -6,8.5 Q-13,7 -13.5,-4Z', inX:-13.5, outX:14, by:-5, ty:-6, rimK:.25, bar:'M-13.2,-7 Q0,-9 14.2,-7'},
    roundSmall: {d:circ(0,0,9.5), inX:-9.5, outX:9.5, by:-1, ty:-2, fwK:.75},
    octagon:    {d:'M-12.5,-4.5 L-7.5,-10 L8,-10 L13,-4.5 L13,4.5 L8,10 L-7.5,10 L-12.5,4.5Z', inX:-12.5, outX:13, by:-3, ty:-4, fwK:.8},
    thickRound: {d:ell(0,0.5,12.5,11.5), inX:-12.5, outX:12.5, by:-2, ty:-3, fwK:1.6},
  };
  const L = LENS[g.type];
  const rimW = fw*(L.rimK||1)*(L.fwK||1);
  const rimC = L.rimK && L.rimK<1 ? mix(frame,'#c7cbd3',.55) : frame;
  const lens = (p, side) => {
    let s = `<g transform="translate(${n1(p.x)},${n1(p.y)}) scale(${n1(side*gs*100)/100},${n1(gs*100)/100})">`;
    s += `<path d="${L.d}" fill="${g.lens}" fill-opacity="${g.lensAlpha}"/>`;
    s += `<path d="M-6,-2 L-1.5,-6.5" stroke="#fff" stroke-opacity="${g.lensAlpha>.4?.6:.45}" stroke-width="${n1(2/gs)}" stroke-linecap="round"/>`;
    if (zombie && side===1) s += `<path d="M2,-9 L-1,-2 L4,1 L1,8" fill="none" stroke="#fff" stroke-opacity=".8" stroke-width="${n1(1/gs)}"/>`;
    s += `<path d="${L.d}" fill="none" stroke="${rimC}" stroke-width="${n1(rimW/gs)}" stroke-linejoin="round"/>`;
    if (L.bar) s += `<path d="${L.bar}" fill="none" stroke="${frame}" stroke-width="${n1(fw*2.1/gs)}" stroke-linecap="round"/>`;
    return s + `</g>`;
  };
  if (L.single){
    const c = {x:100, y:(P.y+PL.y)/2};
    const ex = 35*gs, hx2 = 100 + (F.w-1);
    return out(`<path d="M${n1(100+ex)},${n1(c.y+L.ty)} L${n1(Math.max(hx2,100+ex+2))},${n1(c.y+L.ty-1)} M${n1(100-ex)},${n1(c.y+L.ty)} L${n1(Math.min(200-hx2,100-ex-2))},${n1(c.y+L.ty-1)}" stroke="${frame}" stroke-width="${fw}" stroke-linecap="round"/>`, lens(c,1));
  }
  if (g.type==='monocle'){
    const p = PL;
    return out('', lens(p,-1) + `<path d="M${n1(p.x-4)},${n1(p.y+12*gs)} Q${n1(p.x-10)},${n1(p.y+44)} ${n1(p.x-28)},196" fill="none" stroke="${frame}" stroke-width="1.6" stroke-dasharray="2.4 1.6"/>`);
  }
  const rIn = P.x + L.inX*gs, lIn = PL.x - L.inX*gs;
  let s = `<path d="M${n1(lIn)},${n1(PL.y+L.by)} Q100,${n1((P.y+PL.y)/2+L.by-4)} ${n1(rIn)},${n1(P.y+L.by)}" fill="none" stroke="${frame}" stroke-width="${fw}" stroke-linecap="round"/>`;
  if (L.noTemples){
    s = `<path d="M${n1(lIn)},${n1(PL.y+L.by)} q${n1((rIn-lIn)/4)},-5 ${n1((rIn-lIn)/2)},-1 q${n1((rIn-lIn)/4)},4 ${n1((rIn-lIn)/2)},1" fill="none" stroke="${frame}" stroke-width="${n1(fw*.8)}" stroke-linecap="round"/>`;
    if (L.chain) s += `<path d="M${n1(PL.x-10*gs)},${n1(PL.y+2)} Q${n1(PL.x-16)},${n1(PL.y+46)} ${n1(PL.x-24)},196" fill="none" stroke="${frame}" stroke-width="1.5" stroke-dasharray="2.4 1.6"/>`;
    return out('', s + lens(P,1) + lens(PL,-1));
  }
  if (g.type==='aviator') s += `<path d="M${n1(lIn+1)},${n1(PL.y-8*gs)} L${n1(rIn-1)},${n1(P.y-8*gs)}" stroke="${frame}" stroke-width="${n1(fw*.8)}" stroke-linecap="round"/>`;
  const hx_ = 100 + (F.w-1);
  const arms = `<path d="M${n1(P.x+L.outX*gs)},${n1(P.y+L.ty)} L${n1(Math.max(hx_, P.x+L.outX*gs+2))},${n1(P.y+L.ty-1)} M${n1(PL.x-L.outX*gs)},${n1(PL.y+L.ty)} L${n1(Math.min(200-hx_, PL.x-L.outX*gs-2))},${n1(PL.y+L.ty-1)}" stroke="${frame}" stroke-width="${fw}" stroke-linecap="round"/>`;
  return out(arms, s + lens(P,1) + lens(PL,-1));
}

function drawDetails(S,t,F,skin,headClip){
  let s = '';
  const det = t.details||[];
  if (det.includes('vitiligo')){
    const pale = mix(skin,'#f7e6d8',.62);
    s += `<g clip-path="url(#${headClip})"><path d="${smooth(F.mp([[66,94],[80,88],[90,96],[86,110],[74,116],[62,108]]))}" fill="${pale}"/><path d="${smooth(F.mp([[108,150],[122,144],[132,152],[124,162],[110,162]]))}" fill="${pale}"/><path d="${smooth(F.mp([[124,72],[136,68],[142,78],[134,84]]))}" fill="${pale}"/></g>`;
  }
  if (det.includes('freckles')){
    const col = darken(skin,.32);
    [[-30,118],[-25,122],[-33,124],[-27,128],[-21,119],[30,118],[25,122],[33,124],[27,128],[21,119],[-5,114],[5,114],[0,112]].forEach(([x,y],i)=>{
      s += `<circle cx="${n1(100+x*F.sx)}" cy="${n1(y+F.dy+(F.cheekY-100)*.5)}" r="${i%3?1:1.25}" fill="${col}" opacity=".75"/>`; });
  }
  if (det.includes('wrinkles')){
    const col = darken(skin,.3), y=F.noseY, w=1.2;
    s += `<path d="M${n1(100-13*F.sx)},${y+3} Q${n1(100-17*F.sx)},${y+12} ${n1(100-14*F.sx)},${y+19} M${n1(100+13*F.sx)},${y+3} Q${n1(100+17*F.sx)},${y+12} ${n1(100+14*F.sx)},${y+19}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" opacity=".8"/>`;
    const ey=F.eyeY+S.eyeDY, ex=100+S.eyeDX+11;
    s += `<path d="M${ex},${ey-3} l4,-2 M${ex+.5},${ey+1} l4.5,0.5 M${200-ex},${ey-3} l-4,-2 M${200-ex-.5},${ey+1} l-4.5,0.5" stroke="${col}" stroke-width="${w}" stroke-linecap="round" opacity=".8"/>`;
  }
  if (det.includes('mole')) s += `<circle cx="${n1(100+20*F.sx)}" cy="${F.mouthY-4}" r="1.6" fill="${darken(skin,.55)}"/>`;
  return s;
}

function drawFacialHair(S,t,F,hair,skin,headClip){
  const fh = t.facialHair||'none'; if (fh==='none') return '';
  const my = mouthCenterY(S,t,F), X=100, sx=F.sx;
  const thick = getK(t,'beard.thickness')||0, len = getK(t,'beard.length')||0;
  const mk = 1 + thick*0.14;                                   // moustache weight
  // The moustache spans y -10..-1 around the mouth; keep its top just under the nose.
  const noseBottom = noseBottomY(S,t,F) + 1.5 + S.sw*1.1;
  const mBot = my-6+5*mk, mTop = Math.min(Math.max(my-6-4*mk, noseBottom+0.5), mBot-3);
  const capY = y => Math.max(y, noseBottom+0.5);
  const M = pts => pts.map(([x,y,f]) => { const q = [X+x*sx*(1+thick*.04), mTop + (y+10)/9*(mBot-mTop)]; return f ? [q[0],q[1],f] : q; });
  const must = M([[0,-8],[9,-10],[18,-7],[23,-1],[16,-2],[8,-4],[0,-3],[-8,-4],[-16,-2],[-23,-1],[-18,-7],[-9,-10]]);
  // Outer edge from the real head outline (cheek to cheek), pushed outward so skin never peeks past it.
  // base/amp: margin at sideburns and extra at the chin; drop: extra length at the chin.
  const outline = (base, amp, drop) => {
    const segs = headSegs(F).slice(1,5), c = [100, F.cheekY-14], out = [];
    segs.forEach((sg,si) => { for (let k=0;k<12;k++){ const u=k/12, q=bez(sg,u), g=(si+u)/4, w=Math.sin(Math.PI*g);
      const m = Math.max(1.5 + S.sw*0.5, base + S.sw*0.5 + thick*0.9 + (amp + thick*1.1)*w), dx=q[0]-c[0], dy=q[1]-c[1], L=Math.hypot(dx,dy)||1;
      out.push([q[0]+dx/L*m, q[1]+dy/L*m + Math.pow(w,3)*drop]); } });
    out.push([X-F.w-base-thick*.9, F.cheekY]); out[0] = [X+F.w+base+thick*.9, F.cheekY];
    return out;
  };
  const sharpEnds = (pts) => pts.map((q,i)=> i===0||i===pts.length-1 ? [q[0],q[1],'s'] : q);
  const mouthInner = [[X-F.w+4,F.cheekY],[X-F.w+8,F.cheekY+15],[X-20,capY(my-6)],[X-8,capY(my-9)],[X,capY(my-8)],[X+8,capY(my-9)],[X+20,capY(my-6)],[X+F.w-8,F.cheekY+15],[X+F.w-4,F.cheekY]];
  // Positive length hangs the beard lower; negative length trims the chin bulk but never uncovers the chin.
  const lengthDrop = Math.max(0, len)*4, trim = Math.min(0, len)*1.2;
  const full = (base, amp, drop) => smooth([...sharpEnds(outline(base, Math.max(0, amp + trim), Math.max(0, drop) + lengthDrop)), ...sharpEnds(mouthInner)]);
  const chin = (extra=0) => smooth([[X-9,my+5],[X,my+4],[X+9,my+5],[X+11+thick,my+16+lengthDrop*.6+extra],[X,my+23+thick+lengthDrop+extra],[X-11-thick,my+16+lengthDrop*.6+extra]]);
  const under = d => shape(S, d, hair, {under:true});
  switch (fh){
    case 'stubble':  return `<g clip-path="url(#${headClip})"><path d="${full(2,6,0)}" fill="${mix(hair,skin,.35)}" opacity="${n1(.32+thick*.05)}"/></g>`;
    case 'full':     return shape(S, full(2,6,0), hair);
    case 'short':    return shape(S, full(1.2,2.8,0), hair);
    case 'long':     return shape(S, full(2.5,8,18), hair);
    case 'mustache': return shape(S, smooth(must), hair, {k:.7});
    case 'goatee':   return shape(S, chin(), hair, {k:.7}) + shape(S, smooth(must), hair, {k:.7});
    case 'circle': {
      const bar = sd => smooth([[X+sd*(18+thick)*sx,capY(my-4)],[X+sd*(21+thick)*sx,my+2],[X+sd*13,my+16+lengthDrop*.5],[X+sd*9,my+12],[X+sd*15*sx,my+1],[X+sd*14*sx,capY(my-3)]]);
      return under(smooth(must) + chin() + bar(1) + bar(-1));
    }
    case 'chinStrap': {
      const o = outline(1, 3, 0);
      const inn = o.map(([x,y]) => { const dx=x-100, dy=y-(F.cheekY-14), L=Math.hypot(dx,dy)||1, w=4+thick*.8; return [x-dx/L*w, y-dy/L*w]; });
      return shape(S, smooth([...sharpEnds(o), ...sharpEnds(inn.reverse())]), hair, {k:.8});
    }
    case 'handlebar': return shape(S, smooth(M([[0,-8],[8,-10],[16,-8],[22,-5],[28,-9],[30,-15,'s'],[25,-7],[19,-2],[10,-4],[0,-3],[-10,-4],[-19,-2],[-25,-7],[-30,-15,'s'],[-28,-9],[-22,-5],[-16,-8],[-8,-10]])), hair, {k:.7});
    case 'pencil':    return shape(S, smooth(M([[0,-6.5],[10,-7.5],[19,-5.5],[10,-5.4],[0,-4.6],[-10,-5.4],[-19,-5.5],[-10,-7.5]])), hair, {k:.5});
    case 'soulPatch': return shape(S, smooth([[X-3.5,my+6.5],[X+3.5,my+6.5],[X+2.5,my+12+thick+lengthDrop*.4],[X,my+14+thick+lengthDrop*.5],[X-2.5,my+12+thick+lengthDrop*.4]]), hair, {k:.6});
    case 'muttonChops': {
      const side = sd => { const p = [[X+sd*(F.w+2+thick*.8),F.cheekY],[X+sd*(F.w+2.5+thick),(F.cheekY+F.jawY)/2],[X+sd*(F.jw+4+thick),F.jawY+3],[X+sd*24,my+9+lengthDrop*.4],[X+sd*21,my+1],[X+sd*(F.w-9),F.cheekY+16],[X+sd*(F.w-4),F.cheekY]];
        return smooth(sd>0 ? p : p.slice().reverse()); };
      return under(side(1) + side(-1) + smooth(must));
    }
  }
  return '';
}

// Central render settings, shared by every render() call unless overridden per call:
//   background:      'avatar' (each avatar's own colour) | '#rrggbb' (one colour for all) | 'none' (transparent)
//   backgroundShape: 'style' (the style's default) | 'circle' | 'rounded' | 'full' | 'none'
// Example: render(t, v, 'cel', {background:'none', backgroundShape:'circle'})
const ANYTARS_CONFIG = { background: 'avatar', backgroundShape: 'style' };
const BG_SHAPES = ['style','circle','rounded','full','none'];

function shapeEl(shape, fill){
  if (shape==='circle') return `<circle cx="100" cy="100" r="100" fill="${fill}"/>`;
  if (shape==='rounded') return `<rect width="200" height="200" rx="28" fill="${fill}"/>`;
  if (shape==='full') return `<rect width="200" height="200" fill="${fill}"/>`;
  return '';
}
function background(S, bg, festive, zombie, transparent, shape){
  let s = '';
  if (!transparent && shape!=='none'){
    let fill = S.sticker ? lighten(bg,.25) : bg;
    if (S.bg==='gradient'){ const gid = uid('g'); s += `<linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${lighten(bg,.45)}"/><stop offset="1" stop-color="${bg}"/></linearGradient>`; fill = `url(#${gid})`; }
    s += shapeEl(shape, fill);
    // Style decorations are clipped to the backdrop shape so nothing pokes out of a circle or rounded corner.
    let deco = '';
    if (S.bg==='sparkle'){
      const star = (x,y,r) => `<path d="M${x},${y-r} Q${x+r*.18},${y-r*.18} ${x+r},${y} Q${x+r*.18},${y+r*.18} ${x},${y+r} Q${x-r*.18},${y+r*.18} ${x-r},${y} Q${x-r*.18},${y-r*.18} ${x},${y-r}Z" fill="${lighten(bg,.6)}"/>`;
      deco += `<circle cx="100" cy="104" r="84" fill="${lighten(bg,.2)}"/>` + star(30,38,9) + star(172,64,7) + star(160,24,4.5) + star(24,150,5);
    } else if (S.bg==='gradient'){
      deco += `<path d="M150,0 L200,0 L200,50Z M0,170 L0,200 L30,200Z" fill="${lighten(bg,.6)}" opacity=".6"/>`;
    } else if (S.bg==='circle'){
      deco += `<circle cx="84" cy="84" r="70" fill="${lighten(bg,.22)}"/>`;
    } else if (S.bg==='square'){
      deco += `<circle cx="100" cy="112" r="80" fill="${lighten(bg,.18)}"/>`;
    }
    if (zombie) deco += `<circle cx="160" cy="40" r="16" fill="#e8e4c8" opacity=".55"/>`;
    if (deco){
      if (shape==='full') s += deco;
      else { const dc = uid('bc'); s += `<clipPath id="${dc}">${shapeEl(shape,'#000')}</clipPath><g clip-path="url(#${dc})">${deco}</g>`; }
    }
  }
  if (festive){
    const cols=['#f0453f','#f2c230','#3aa7e0','#7bc96f','#b86bd8'];
    [[22,30,20],[44,70,-30],[170,40,40],[156,86,10],[30,120,60],[176,140,-20],[64,22,15],[136,18,-45]].forEach(([x,y,r],i)=>{
      s += `<rect x="${x}" y="${y}" width="8" height="4" rx="1.2" fill="${cols[i%5]}" transform="rotate(${r} ${x+4} ${y+2})"/>`; });
  }
  return s;
}

function render(traits, variant={}, styleKey='chibi', opts={}){
  const S = STYLES[styleKey];
  const t = traits;
  const zombie = variant.transform==='zombie', festive = variant.transform==='festive';
  let ex = EXPR[zombie ? 'zombie' : (festive ? 'laughing' : (variant.expression||'neutral'))];
  const cfg = {...ANYTARS_CONFIG, ...opts};
  if (cfg.cryMouth && ex.mouth === 'wail') ex = { ...ex, mouth: cfg.cryMouth };
  if (cfg.cryEyes && ex.mouth && /^(wail|cry)/.test(ex.mouth) && ex.closed) ex = { ...ex, closed: cfg.cryEyes };
  const bgNone = cfg.background === 'none';
  const bgShape = BG_SHAPES.includes(cfg.backgroundShape) && cfg.backgroundShape!=='style' ? cfg.backgroundShape : S.bgShape;
  let skin=t.skin, hair=t.hair.color, shirt=t.shirt, bg=(/^#[0-9a-f]{6}$/i.test(cfg.background||'') ? cfg.background : t.bg), hwColor=t.headwear?.color||'#888888';
  if (zombie){ skin=mix(desat(skin,.55),'#8db27a',.5); hair=mix(desat(hair,.4),'#5d5a4c',.35); shirt=mix(desat(shirt,.5),'#5d5a4c',.4); bg=mix(bg,'#38423a',.62); hwColor=desat(hwColor,.4); }
  const F = faceGeom(t.face);
  if (S.chibi){ F.chinW += 7; F.chinY -= 3; F.jawY -= 2; }
  if (S.anime){ F.chinW = Math.max(5, F.chinW-4); F.jw -= 1; F.jawY -= 2; F.chinY += 2; }
  let hwType = t.headwear?.type||'none';
  if (festive && hwType==='none') hwType = 'partyHat';
  const HW = HEADWEAR[hwType];
  // Secondary hat colour: configurable (t.headwear.accent), otherwise the hat's own default.
  let hwAccent = t.headwear?.accent || (typeof HW.accent === 'function' ? HW.accent(hwColor) : HW.accent) || hwColor;
  if (zombie && t.headwear?.accent) hwAccent = desat(hwAccent,.4);
  // Brim hats sit higher when they would otherwise cover the brows (brows carry the expressions).
  const hatUp = HW.brimY ? Math.min(20, Math.max(0, HW.brimY + F.dy - (browTopY(S,t,F) - 1.5))) : 0;
  // A hat sits over the hair: if the hair is wider than the hat band, widen the hat (up to 25%) so the hair
  // tucks under its edge instead of being cut off in a straight line.
  let hatW = 1;
  if (HW.bandW && !HW.hideHairTop){
    const topW = HAIR_TOP[t.hair.top] ? (HAIR_TOP_W[t.hair.top] || 49) : 0;
    const backW = HW.hideHairBack ? 0 : ({ long: 57, longWavy: 59, bob: 57 }[t.hair.back] || 0);
    hatW = Math.min(1.25, Math.max(1, (Math.max(topW, backW) + 1.5) / HW.bandW));
    // ...but never so wide that the hat leaves the canvas (that would shrink the whole avatar).
    if (HW.box){ const h = S.head||1, avail = (S.sticker ? 105 : 96) - (S.sw*1.2 + 2);
      const ext = Math.max((100 - HW.box.x0), (HW.box.x1 - 100)) * F.sx * h;
      hatW = Math.max(1, Math.min(hatW, avail / ext)); }
  }
  const hatT = (hatUp || hatW !== 1) ? `translate(100,${n1(-hatUp)}) scale(${n1(hatW*1000)/1000},1) translate(-100,0)` : '';
  const ink = S.line || mix(darken(skin,.7),'#1b1520',.55);
  const browBase = t.brows.color ? (zombie ? desat(t.brows.color,.4) : t.brows.color) : null;
  const browCol = browBase ? darken(browBase,.12) : (hx(hair).reduce((a,b)=>a+b,0) > 560 ? darken(hair,.35) : mix(hair,'#120e12',.25));
  const beardCol = t.facialHairColor ? (zombie ? mix(desat(t.facialHairColor,.4),'#5d5a4c',.35) : t.facialHairColor) : hair;

  const headT = S.head!==1 ? `translate(100,${S.headY||120}) scale(${S.head}) translate(-100,-112)` : '';
  const bodyT = S.body!==1 ? `translate(100,196) scale(${S.body}) translate(-100,-196)` : '';
  const tiltT = zombie ? 'rotate(-5 100 160)' : ex.tilt ? `rotate(${ex.tilt} 100 150)` : '';
  const H = s => `<g transform="${headT} ${tiltT}">${s}</g>`;
  const B = s => (bodyT || ex.hands) ? `<g transform="${ex.hands ? 'translate(0,-5) ' : ''}${bodyT}">${s}</g>` : s;

  const headD = headPath(F);
  const headClip = uid('hc');
  let hairClip = '';
  let defs = `<clipPath id="${headClip}"><path d="${headD}"/></clipPath>`;
  if (HW.hairMask){
    hairClip = uid('hm');
    const edge = F.mp(HW.hairMask).map(q => [100 + (q[0]-100)*hatW, q[1] - hatUp]);
    const m = [[edge[0][0], -60], [edge.at(-1)[0], -60], ...edge.slice().reverse()];   // column above the hat's lower edge
    defs += `<clipPath id="${hairClip}"><path clip-rule="evenodd" d="M-60,-60H260V260H-60Z M${m.map(q=>n1(q[0])+','+n1(q[1])).join('L')}Z"/></clipPath>`;
  }
  const HC = s => hairClip ? `<g clip-path="url(#${hairClip})">${s}</g>` : s;

  // hair geometry
  const back = HW.hideHairBack ? null : HAIR_BACK[t.hair.back];
  const topDef = HW.hideHairTop ? null : HAIR_TOP[t.hair.top];
  const curlyTop = topDef==='curly' || topDef==='afroCurly';
  const topD = !topDef ? null : (curlyTop ? curlyD(F, topDef==='afroCurly') : smooth(F.mp(topDef)));
  // Accent colour: configurable (t.hair.accent), otherwise a shade of the hair colour.
  let accent = t.hair.accent || (hx(hair).reduce((a,b)=>a+b,0) < 120 ? lighten(hair,.14) : darken(hair,.28));
  if (zombie) accent = mix(desat(accent,.4),'#5d5a4c',.35);
  const aw = S.sw ? Math.max(1.3, S.sw*.55) : 1.6;

  let L = '';
  // 1. hair behind the head
  if (back && back.behind){
    const d = back.behind==='afro' ? afroD(F) : smooth(F.mp(back.behind));
    const bAcc = back.behind==='afro' ? `<path d="${curlMarks(afroCurls(F), .5)}" stroke="${accent}" stroke-width="${aw}" stroke-linecap="round" fill="none" opacity=".85"/>` : accentGroup(F, hairAccent(F, HAIR_ACCENT_BACK[t.hair.back]), accent, aw);
    let bs = shape(S, d, darken(hair,.08), {under: back.behind==='afro', inner: bAcc});
    // Big volume gets pressed down under a hat, then hidden above the crown.
    if (HW.hairMask && back.behind==='afro') bs = `<g transform="translate(0,${140+F.dy}) scale(1,.72) translate(0,${-140-F.dy})" transform-origin="100 0">${bs}</g>`;
    L += tag('hairBack', H(HC(bs)));
  }
  // Long hair: shaded hair fill behind the neck so no background shows between neck and hair.
  if (back && back.base) L += tag('hairBack', H(HC(`<path d="${smooth(F.mp([[100,138],[118,146],[124,170],[126,210],[74,210],[76,170],[82,146]]))}" fill="${darken(hair,.3)}"/>`)));
  const hairTopY = Math.min(topDef ? HAIR_TOP_Y[t.hair.top] : 50, back ? HAIR_BACK_Y[t.hair.back] : 99) + F.dy;
  const hwCtx = { lift: Math.min(0, hairTopY - (38 + F.dy)), seat: hairTopY - (38 + F.dy) + 1 };
  // 2. neck + shirt
  const nw = 14*F.sx, nTop = F.jawY-8;
  const neckD = `M${n1(100-nw)},${nTop} L${n1(100+nw)},${nTop} L${n1(100+nw+1)},192 L${n1(100-nw-1)},192Z`;
  const neckClip = uid('nc');
  let neck = `<clipPath id="${neckClip}"><path d="${neckD}"/></clipPath><path d="${neckD}" fill="${skin}"${strokeAttr(S,skin)}/>`;
  neck += `<g clip-path="url(#${neckClip})"><path d="${headD}" fill="${darken(skin,S.shade==='none'?.14:.26)}" transform="translate(0,${S.shade==='none'?5:8})"/></g>`;
  const shirtD = smooth([[8,206],[12,188],[30,175],[60,166],[86,161,'s'],[100,172],[114,161,'s'],[140,166],[170,175],[188,188],[192,206]]);
  if (!ex.flip) L += tag('body', B(neck + shape(S, shirtD, shirt)));
  if (zombie) L += tag('body', B(`<path d="M60,190 l6,-10 l4,8 l5,-12 l3,14 M132,186 l5,-9 l3,7" fill="none" stroke="${darken(shirt,.5)}" stroke-width="2" stroke-linejoin="round"/>`));
  // 3. drapes (long hair over shoulders, hijab)
  if (back && back.base) L += tag('hairBack', H(HC(shape(S, smooth(F.mp(back.base)), darken(hair,.1), {inner: accentGroup(F, hairAccent(F, HAIR_ACCENT_BACK[t.hair.back]), accent, aw)}))));
  if (HW.drape) L += tag('headwearBack', HW.drape(S,F,hwColor));

  // 4. the face group
  let face = '', ears = '';
  if (!HW.hideEars){
    [-1,1].forEach(side=>{
      const x = 100+side*(F.w-1.5), y=F.eyeY+4;
      ears += shape(S, ell(x,y,6.8,10.5), skin, {k:.85});
      ears += `<path d="M${n1(x+side*1.5)},${y-5} Q${n1(x-side*2.5)},${y} ${n1(x+side*1.5)},${y+5}" fill="none" stroke="${darken(skin,.3)}" stroke-width="1.4" stroke-linecap="round"/>`;
    });
  }
  face += tag('ears', ears);
  // head with optional forehead shadow under hair / hats
  let inner = '';
  if (S.shade!=='none'){
    const sh = darken(skin,.2);
    if (topD && !curlyTop) inner += hairClip ? '' : `<path d="${topD}" fill="${sh}" transform="translate(1.5,4.5)"/>`;
    if (curlyTop) inner += `<path d="${topD}" fill="${sh}" transform="translate(1.5,4.5)"/>`;
    // Hat cast shadow: a thin strip that follows the hat's lower edge (a fixed rectangle read as a dark bar).
    if (HW.hairMask){
      const edge = F.mp(HW.hairMask), deep = 4.5;
      const pts = [...edge.map((q,i) => i===0||i===edge.length-1 ? [q[0],q[1],'s'] : q), ...edge.slice(1,-1).reverse().map(q => [q[0], q[1] + deep])];
      inner += `<path d="${smooth(pts)}" fill="${sh}" opacity=".5"${hatT ? ` transform="${hatT}"` : ''}/>`;
    } else if (HW.shadow) inner += `<path d="${smooth(F.mp(HW.shadow))}" fill="${sh}" opacity=".6"${hatT ? ` transform="${hatT}"` : ''}/>`;
  }
  // Cheeks: t.cheeks.amount = auto (style default) | none | light | medium | strong; expressions can add more.
  const ck = t.cheeks || {}, CHEEK_LVL = { light: .25, medium: .45, strong: .7 };
  const blush = ck.amount === 'none' ? 0 : Math.max(ex.blush||0, CHEEK_LVL[ck.amount] ?? (S.blush || (S.shade==='cel' ? .18 : 0)));
  const blushC = ck.color || '#ff5d82';
  if (S.anime && blush>=.4 && !zombie) [-1,1].forEach(sd => { const bx=100+sd*27*F.sx, by=F.noseY+4; for (let k=-1;k<=1;k++) inner += `<path d="M${n1(bx+k*3.4-1.4)},${by+2.2} l2.8,-4.4" stroke="${darken(blushC,.12)}" stroke-width="1" stroke-linecap="round" opacity=".7"/>`; });
  if (blush && !zombie) inner += `<ellipse cx="${n1(100-27*F.sx)}" cy="${F.noseY+4}" rx="7.5" ry="4.2" fill="${blushC}" opacity="${n1(blush*.42)}"/><ellipse cx="${n1(100+27*F.sx)}" cy="${F.noseY+4}" rx="7.5" ry="4.2" fill="${blushC}" opacity="${n1(blush*.42)}"/>`;
  face += tag('head', shape(S, headD, skin, {inner}));
  face += tag('details', drawDetails(S,t,F,skin,headClip));
  if (zombie){ let zs = '';
    const sx=100-26*F.sx, sy=F.noseY+6;
    zs += `<path d="M${n1(sx-8)},${sy-6} L${n1(sx+8)},${sy+6}" stroke="${darken(skin,.55)}" stroke-width="1.6" stroke-linecap="round"/>`;
    for (let i=-2;i<=2;i++) zs += `<path d="M${n1(sx+i*3.2-2.2)},${n1(sy+i*2.4+3)} l4.4,-6" stroke="${darken(skin,.55)}" stroke-width="1.3" stroke-linecap="round"/>`;
    face += tag('details', zs);
  }
  // eyes
  const flipC = ((eyePos(S,F,t,1).y) + mouthCenterY(S,t,F)) / 2;
  const FL = s => s;
  const eyeMode = cfg.eyeMode || (t.eyes.render && t.eyes.render!=='auto' ? t.eyes.render : S.eyeDefault);
  face += tag('eyes', FL(drawEye(S,t,F,ex,-1,t.eyes.left,skin,ink,eyeMode) + drawEye(S,t,F,ex,1,t.eyes.right,skin,ink,eyeMode)));
  face += tag('nose', FL(drawNose(S,t,F,skin)));
  face += tag('beard', drawFacialHair(S,t,F,beardCol,skin,headClip));
  // Tears stay on the face: clipped to the head outline.
  if (ex.rivers) face += tag('tears', `<g clip-path="url(#${headClip})">${drawRivers(S,t,F,-1) + drawRivers(S,t,F,1)}</g>`);
  face += tag('mouth', FL(drawMouth(S,t,F,ex,skin,ink,zombie)));
  face += tag('glasses', FL(drawGlasses(S,t,F,zombie,'back')));
  // hair on top
  if (topD){
    let hs = '';
    if (t.hair.top==='undercut'){
      const side = [[55,104],[54,84],[62,72],[67,75],[63,104]];
      const sc = mix(hair,skin,.55);
      hs += shape(S, smooth(F.mp(side)), sc, {noShade:true}) + shape(S, smooth(F.mp(mirrorPts(side))), sc, {noShade:true});
    }
    const hl = S.anime && !curlyTop ? `<path d="M${n1(100-30*F.sx)},${58+F.dy} Q100,${44+F.dy} ${n1(100+30*F.sx)},${58+F.dy}" fill="none" stroke="${lighten(hair,.5)}" stroke-width="4.5" stroke-linecap="round" opacity=".7" transform="translate(-3,0)"/>` + `<path d="M${n1(100-14*F.sx)},${62+F.dy} q4,10 1,20 M${n1(100+10*F.sx)},${60+F.dy} q-3,9 0,17" fill="none" stroke="${darken(hair,.3)}" stroke-width="1.2" opacity=".7"/>` :
      S.shade==='cel' && !curlyTop ? `<path d="M${n1(100-26*F.sx)},${54+F.dy} Q100,${40+F.dy} ${n1(100+22*F.sx)},${52+F.dy}" fill="none" stroke="${lighten(hair,.4)}" stroke-width="4.5" stroke-linecap="round" opacity=".75" transform="translate(-6,4)"/>` : '';
    // With back hair present, the top is outlined only where it meets the face, so the two read as one head of hair.
    const merged = !!back && !curlyTop;
    const acc = curlyTop ? `<path d="${curlMarks(curlyGeom(F, topDef==='afroCurly').bumps, .55)}" stroke="${accent}" stroke-width="${aw}" stroke-linecap="round" fill="none" opacity=".9"/>` : accentGroup(F, hairAccent(F, HAIR_ACCENT_TOP[t.hair.top]), accent, aw);
    let topShape = shape(S, topD, t.hair.top==='buzz' ? mix(hair,skin,.25) : hair, {under: curlyTop, inner: hl + acc, strokeClip: merged ? headClip : null, noShade: merged && S.shade==='hard'});
    // A big curly top is pressed down under a hat, like the afro.
    if (HW.hairMask && topDef==='afroCurly') topShape = `<g transform="translate(0,${110+F.dy}) scale(1.03,.7) translate(0,${-110-F.dy})" transform-origin="100 0">${topShape}</g>`;
    hs += topShape;
    face += tag('hairTop', HC(hs));
  }
  // Brows and lenses sit on top of the hair (cartoon convention), glasses arms stay under it.
  face += tag('brows', FL(drawBrow(S,t,F,ex,-1,browCol) + drawBrow(S,t,F,ex,1,browCol)));
  if (!HW.glassesOver) face += tag('glasses', FL(drawGlasses(S,t,F,zombie,'front')));
  if (HW.front) face += tag('headwear', hatT ? `<g transform="${hatT}">${HW.front(S,F,hwColor,hwCtx,hwAccent)}</g>` : HW.front(S,F,hwColor,hwCtx,hwAccent));
  if (HW.glassesOver) face += tag('glasses', FL(drawGlasses(S,t,F,zombie,'front')));

  if (ex.heart){
    const x = 100 + 16*F.sx, y = mouthCenterY(S,t,F) - 4;
    face += tag('tears', `<path d="M0,4 C-7,-1 -5.5,-7.5 0,-3.4 C5.5,-7.5 7,-1 0,4Z" transform="translate(${n1(x)},${n1(y)}) rotate(18) scale(.9)" fill="#e5304f" stroke="${ink}" stroke-width="${n1(S.sw ? S.sw*.5 : 1)}" stroke-linejoin="round"/>`);
  }
  if (ex.zzz){
    const z = (x,y,k) => `<path d="M${n1(x)},${n1(y)} h${n1(k)} l${n1(-k)},${n1(k)} h${n1(k)}" fill="none" stroke="${zombie ? '#e8e4c8' : '#5868c9'}" stroke-width="${n1(1.4 + k*.18)}" stroke-linecap="round" stroke-linejoin="round"/>`;
    const bx = 100 + (F.w - 4)*F.sx, by = F.top + 10;
    face += tag('tears', z(bx, by, 6) + z(bx + 9, by - 12, 8) + z(bx + 20, by - 27, 10));
  }
  if (ex.joyTears){
    let jt = '';
    [-1,1].forEach(side => {
      const pe = eyePos(S,F,t,side), sc = S.eye*(1+tv(t,'eyes.size')), x = pe.x + side*(EYES[t.eyes.shape].W*sc + 2), y = pe.y + 1;
      // Drops fly outwards and up: the pointed end trails back towards the eye.
      [[0, 0, 1], [8, -5, .72]].forEach(([dx, dy, k]) => jt += `<path d="M0,-6 Q4.2,0 3.2,3.2 Q0,6.2 -3.2,3.2 Q-4.2,0 0,-6Z" transform="translate(${n1(x + side*(dx + 2))},${n1(y + dy - 2)}) rotate(${side*-128}) scale(${k})" fill="#7cc6f2" stroke="${ink}" stroke-width="${n1(Math.max(.8, S.sw*.35)/k)}"/>`);
    });
    face += tag('tears', jt);
  }
  L += H(face);
  // Upside-down (🙃): the whole head turns over, shoulders left out, centred in the frame.
  if (ex.flip){
    const hy = (S.headY||120) + ((F.top + F.chinY)/2 - 112) * (S.head||1);
    L = `<g transform="translate(0,${n1(100 - hy)}) rotate(180 100 ${n1(hy)})">${L}</g>`;
  }
  if (ex.hands){
    // Shrug: forearms from the raised shoulders and open palms, drawn in body coordinates.
    const lc = lineFor(S, skin) || 'none', sw = S.sw || 0;
    const rot = (cx,cy,rx,ry,deg) => { const a = deg*Math.PI/180, pts = []; for (let i=0;i<8;i++){ const u = -i/8*Math.PI*2; const x = rx*Math.cos(u), y = ry*Math.sin(u); pts.push([cx + x*Math.cos(a) - y*Math.sin(a), cy + x*Math.sin(a) + y*Math.cos(a)]); } return smooth(pts); };
    const hand = [rot(0,0,9.5,6.5,-12), rot(3,-8,2.7,6.2,18), rot(7.5,-6.6,2.7,6.2,36), rot(11,-3.6,2.6,5.8,56), rot(12.6,.4,2.4,5,76), rot(-7.5,-4.5,2.6,5.2,-38)].join('');
    let hs = '';
    [1,-1].forEach(side => {
      const g = side === 1 ? '' : ' transform="translate(200,0) scale(-1,1)"';
      const arm = 'M146,186 Q156,170 163,158';
      hs += `<g${g}>` + (sw ? `<path d="${arm}" fill="none" stroke="${lineFor(S, shirt)}" stroke-width="${n1(14 + sw*2)}" stroke-linecap="round"/>` : '')
        + `<path d="${arm}" fill="none" stroke="${shirt}" stroke-width="14" stroke-linecap="round"/>`
        + `<g transform="translate(166,150)">${shape(S, hand, skin, {under:true, k:.7})}</g></g>`;
    });
    L += tag('hands', B(hs));
  }

  // Fit: if hair or headwear would leave the canvas, shrink the whole avatar slightly (anchored at the bottom centre).
  {
    const ext = [[F.top, 100-F.w-6, 100+F.w+6]];
    if (topDef){ const w = HAIR_TOP_W[t.hair.top] || 49, top = HW.hairMask && topDef==='afroCurly' ? 110+F.dy-(110-HAIR_TOP_Y.afroCurly)*.7 : HAIR_TOP_Y[t.hair.top]+F.dy; ext.push([top, 100-w*F.sx, 100+w*F.sx]); }
    if (back){
      const bw = {afro:75, long:63, longWavy:63, bob:56}[t.hair.back] || 50;
      const top = back.behind==='afro' && HW.hairMask ? 140+F.dy-(140-11)*.72 : HAIR_BACK_Y[t.hair.back]+F.dy;
      ext.push([top, 100-bw*F.sx, 100+bw*F.sx]);
    }
    if (HW.box){ const b = HW.box, lift = (b.seat ? hwCtx.seat : hwCtx.lift*(b.perch||0)) - hatUp;
      ext.push([b.top+F.dy+lift, 100+(b.x0-100)*F.sx*hatW, 100+(b.x1-100)*F.sx*hatW]); }
    const h = S.head||1, hy = S.headY||120, pad = S.sw*1.2 + 2;
    const lo = S.sticker ? -5 : 4, hi = S.sticker ? 205 : 196;
    let fit = 1;
    ext.forEach(([top, x0, x1]) => {
      const yc = h!==1 ? hy + (top-112)*h - pad : top - pad, xl = 100 + (x0-100)*h - pad, xr = 100 + (x1-100)*h + pad;
      if (yc < lo) fit = Math.min(fit, (200-lo)/(200-yc));
      if (xl < lo) fit = Math.min(fit, (100-lo)/(100-xl));
      if (xr > hi) fit = Math.min(fit, (hi-100)/(xr-100));
    });
    if (fit < 1) L = `<g transform="translate(100,200) scale(${n1(fit*1000)/1000}) translate(-100,-200)">${L}</g>`;
  }

  let content = L;
  if (S.sticker){
    const fid = uid('f'), cid = uid('sc');
    defs += `<filter id="${fid}" x="-10%" y="-10%" width="120%" height="120%"><feMorphology in="SourceAlpha" operator="dilate" radius="5.5" result="d"/><feFlood flood-color="#ffffff"/><feComposite in2="d" operator="in" result="w"/><feOffset in="d" dy="2.5" result="o"/><feFlood flood-color="#1b1520" flood-opacity=".22"/><feComposite in2="o" operator="in" result="s"/><feMerge><feMergeNode in="s"/><feMergeNode in="w"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
    defs += `<clipPath id="${cid}"><rect x="-20" y="-20" width="240" height="210"/></clipPath>`;
    content = `<g filter="url(#${fid})"><g transform="translate(100,100) scale(.9) translate(-100,-100)"><g clip-path="url(#${cid})">${L}</g></g></g>`;
  } else if (bgShape==='circle' || bgShape==='rounded'){
    const cc = uid('cc');
    defs += `<clipPath id="${cc}">${shapeEl(bgShape,'#000')}</clipPath>`;
    content = `<g clip-path="url(#${cc})">${L}</g>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" role="img"><defs>${defs}</defs>${background(S,bg,festive,zombie,bgNone,bgShape)}${content}</svg>`;
}

// =====================================================================
// Reversible avatar code (prototype): enums as bytes, colours as RGB.
// =====================================================================
const ENUMS = {
  face:Object.keys(FACES), hairTop:Object.keys(HAIR_TOP), hairBack:Object.keys(HAIR_BACK), eyeShape:Object.keys(EYES),
  lashes:['none','natural','long'], brows:Object.keys(BROWS), nose:Object.keys(NOSES), mouthWidth:['small','medium','wide'],
  lips:['thin','medium','full'], facialHair:['none','stubble','mustache','goatee','full','short','long','circle','chinStrap','handlebar','pencil','soulPatch','muttonChops'],
  glasses:['none','round','rect','cateye','aviator','half','monocle','oval','wayfarer','browline','hexagon','rimless','oversized','heart','star','shield','pinceNez',
           'square','softSquare','panto','narrow','semiRim','roundSmall','octagon','thickRound'], headwear:Object.keys(HEADWEAR),
};
const DETAILS = ['freckles','wrinkles','mole','vitiligo'];
const b64u = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const unb64u = s => Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')), c=>c.charCodeAt(0));
function encode(t){
  const e = (list,v) => Math.max(0, ENUMS[list].indexOf(v));
  const g = t.glasses||{type:'none'};
  const bytes = [1,
    e('face',t.face), e('hairTop',t.hair.top), e('hairBack',t.hair.back), e('eyeShape',t.eyes.shape), e('lashes',t.eyes.lashes||'none'),
    e('brows',t.brows.type), e('nose',t.nose.type), e('mouthWidth',t.mouth.width), e('lips',t.mouth.lips), e('facialHair',t.facialHair||'none'),
    e('glasses',g.type), e('headwear',t.headwear?.type||'none'),
    DETAILS.reduce((m,d,i)=>m|((t.details||[]).includes(d)?1<<i:0),0),
    ...TUNE.filter(x=>!x.late).map(x => (getK(t,x.key)||0) & 0xff),
    Math.round((g.lensAlpha??0)*255)];
  [t.skin,t.hair.color,t.eyes.left,t.eyes.right,g.frame||'#000000',g.lens||'#000000',t.headwear?.color||'#000000',t.shirt,t.bg,
   t.brows.color||t.hair.color, t.facialHairColor||t.hair.color].forEach(c=>bytes.push(...hx(c)));
  bytes.push(Math.max(0, EYE_RENDER.indexOf(t.eyes.render||'auto')));
  TUNE.filter(x=>x.late).forEach(x => bytes.push((getK(t,x.key)||0) & 0xff));
  // Appended fields (append only, never reorder): optional colours as [present, r, g, b].
  [t.hair.accent, t.headwear?.accent].forEach(c => { if (c) bytes.push(1, ...hx(c)); else bytes.push(0, 0, 0, 0); });
  bytes.push(Math.max(0, CHEEKS.indexOf(t.cheeks?.amount || 'auto')));
  if (t.cheeks?.color) bytes.push(1, ...hx(t.cheeks.color)); else bytes.push(0, 0, 0, 0);
  return 'v1.' + b64u(bytes);
}
function decode(code){
  const b = unb64u(code.split('.')[1]); let i = 1;
  const E = list => ENUMS[list][b[i++]];
  const t = {face:E('face'), hair:{top:E('hairTop'), back:E('hairBack')}, eyes:{shape:E('eyeShape'), lashes:E('lashes')},
    brows:{type:E('brows')}, nose:{type:E('nose')}, mouth:{width:E('mouthWidth'), lips:E('lips')}, facialHair:E('facialHair')};
  const gl = E('glasses'), hw = E('headwear'), dm = b[i++];
  t.details = DETAILS.filter((d,k)=>dm&(1<<k));
  TUNE.filter(x=>!x.late).forEach(x => { const v = (b[i++]<<24)>>24; if (v) setK(t,x.key,v); });
  const la = b[i++]/255;
  const C = () => toHex([b[i++],b[i++],b[i++]]);
  t.skin=C(); t.hair.color=C(); t.eyes.left=C(); t.eyes.right=C();
  const fr=C(), le=C(), hc=C(); t.shirt=C(); t.bg=C();
  const bc=C(), fc=C(); if (bc!==t.hair.color) t.brows.color=bc; if (fc!==t.hair.color) t.facialHairColor=fc;
  if (i < b.length){ const er = EYE_RENDER[b[i++]]; if (er && er!=='auto') t.eyes.render = er; }
  t.glasses = {type:gl, frame:fr, lens:le, lensAlpha:Math.round(la*100)/100};
  t.headwear = {type:hw, color:hc};
  TUNE.filter(x=>x.late).forEach(x => { if (i < b.length){ const v = (b[i++]<<24)>>24; if (v) setK(t,x.key,v); } });
  const opt = () => { if (i + 3 >= b.length) { i = b.length; return null; } const f = b[i++]; const c = toHex([b[i++],b[i++],b[i++]]); return f ? c : null; };
  const ha = opt(); if (ha) t.hair.accent = ha;
  const wa = opt(); if (wa) t.headwear.accent = wa;
  if (i < b.length){ const am = CHEEKS[b[i++]]; const cc = opt(); if ((am && am !== 'auto') || cc) t.cheeks = { ...(am && am !== 'auto' ? { amount: am } : {}), ...(cc ? { color: cc } : {}) }; }
  return t;
}

export {
  render, encode, decode, variantLabel, getK, setK,
  ANYTARS_CONFIG, STYLES, ENUMS, TUNE, EXPR, EXPRESSIONS, VARIANTS, EYE_RENDER, EYE_RENDER_LABEL, CHEEKS, BG_SHAPES,
  FACES, HAIR_TOP, HAIR_BACK, EYES, BROWS, NOSES, HEADWEAR,
};
