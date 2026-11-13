// Example characters for the maker and the lab (not part of the library package).
// Requires the anytars global build (/anytars.js) to be loaded first.
"use strict";
// =====================================================================
// Cast
// =====================================================================
const CAST = [
  {id:'abena', name:'Abena', blurb:'Grey afro, reading glasses, smile lines',
   skin:'#6b4128', face:'round', hair:{top:'afroTop', back:'afro', color:'#d4cfc8'},
   eyes:{shape:'round', left:'#3a2214', right:'#3a2214', lashes:'natural', size:-1}, brows:{type:'medium', y:-1}, nose:{type:'broad', size:1}, mouth:{width:'medium', lips:'full'},
   facialHair:'none', details:['wrinkles'], glasses:{type:'half', frame:'#c79a2b', lens:'#ffffff', lensAlpha:.15}, headwear:{type:'none'}, shirt:'#2d7d6e', bg:'#f3d27a'},
  {id:'kenji', name:'Kenji', blurb:'Undercut, round glasses, freckles',
   skin:'#f2cfae', face:'oval', hair:{top:'undercut', back:'none', color:'#1d1a1f'},
   eyes:{shape:'monolid', left:'#3a2a20', right:'#3a2a20', lashes:'none', tilt:1}, brows:{type:'straight', tilt:1}, nose:{type:'small', y:-1}, mouth:{width:'medium', lips:'thin'},
   facialHair:'none', details:['freckles'], glasses:{type:'round', frame:'#2b2b33', lens:'#ffffff', lensAlpha:.12}, headwear:{type:'none'}, shirt:'#e3554a', bg:'#bfe0f2'},
  {id:'harpreet', name:'Harpreet', blurb:'Dastar, full beard, thick brows',
   skin:'#a8703f', face:'square', hair:{top:'none', back:'none', color:'#1a1416'},
   eyes:{shape:'almond', left:'#2e1c12', right:'#2e1c12', lashes:'none', spacing:-1}, brows:{type:'thick', y:1, tilt:-1}, nose:{type:'pointed', size:1}, mouth:{width:'wide', lips:'medium'},
   facialHair:'full', details:[], glasses:{type:'none'}, headwear:{type:'turban', color:'#d9682b'}, shirt:'#2e4a8c', bg:'#d6e8c4'},
  {id:'wren', name:'Wren', blurb:'Heterochromia, long red hair, witch hat',
   skin:'#fbe1d1', face:'heart', hair:{top:'centerPart', back:'longWavy', color:'#b5441f'},
   eyes:{shape:'round', left:'#3f8f5a', right:'#4c86c9', lashes:'long', size:1, spacing:1}, brows:{type:'arched'}, nose:{type:'button', size:-1}, mouth:{width:'small', lips:'medium'},
   facialHair:'none', details:['freckles'], glasses:{type:'none'}, headwear:{type:'witchHat', color:'#3b2b5c'}, shirt:'#6b8f3a', bg:'#f2c6d4'},
  {id:'eli', name:'Eli', blurb:'Kippah, monocle, curls, stubble',
   skin:'#d0a27a', face:'long', hair:{top:'curly', back:'none', color:'#4a3222'},
   eyes:{shape:'downturned', left:'#5b3b22', right:'#5b3b22', lashes:'none'}, brows:{type:'bushy', spacing:1}, nose:{type:'pointed', size:2, y:1}, mouth:{width:'medium', lips:'medium'},
   facialHair:'stubble', details:['mole'], glasses:{type:'monocle', frame:'#b8892b', lens:'#e7a33a', lensAlpha:.35}, headwear:{type:'kippah', color:'#2b4c9c'}, shirt:'#3d5a80', bg:'#ffd9b0'},
  {id:'amira', name:'Amira', blurb:'Hijab, cat-eye glasses with rose lenses',
   skin:'#e2ad84', face:'oval', hair:{top:'fringe', back:'bob', color:'#2a1d18'},
   eyes:{shape:'almond', left:'#8a6a2f', right:'#8a6a2f', lashes:'long', tilt:2}, brows:{type:'medium', tilt:1}, nose:{type:'straight'}, mouth:{width:'medium', lips:'full', y:1},
   facialHair:'none', details:[], glasses:{type:'cateye', frame:'#1b1b1f', lens:'#e86a8a', lensAlpha:.35}, headwear:{type:'hijab', color:'#7a3b69'}, shirt:'#e8c35a', bg:'#cde6e1'},
  {id:'mateo', name:'Mateo', blurb:'Vitiligo, mustache, aviator sunglasses, cap',
   skin:'#c98d5b', face:'square', hair:{top:'short', back:'none', color:'#2b1d16'},
   eyes:{shape:'round', left:'#3d2618', right:'#3d2618', lashes:'none'}, brows:{type:'thick'}, nose:{type:'broad'}, mouth:{width:'wide', lips:'thin'},
   facialHair:'mustache', details:['vitiligo'], glasses:{type:'aviator', frame:'#c0c4cc', lens:'#26303c', lensAlpha:.88}, headwear:{type:'baseballCap', color:'#e8b62c'}, shirt:'#3a3f4a', bg:'#ffc8b8'},
  {id:'david', name:'David', blurb:'Rectangular black frames, sandy full beard, big grin',
   skin:'#efc2a4', face:'round', hair:{top:'receding', back:'none', color:'#6e5038'},
   eyes:{shape:'almond', left:'#6f8a7e', right:'#6f8a7e', lashes:'none', size:-1}, brows:{type:'thin', color:'#b89466', y:1},
   nose:{type:'broad', size:1}, mouth:{width:'wide', lips:'medium'},
   facialHair:'full', facialHairColor:'#a98559', details:[], glasses:{type:'rect', frame:'#16161a', lens:'#ffffff', lensAlpha:.1},
   headwear:{type:'none'}, shirt:'#202027', bg:'#cfe0ee'},
  {id:'marie', name:'Marie', blurb:'Long straight blonde hair, grey-blue eyes',
   skin:'#f5d6c4', face:'oval', hair:{top:'sidePart', back:'long', color:'#cfac72'},
   eyes:{shape:'almond', left:'#7a93a8', right:'#7a93a8', lashes:'natural'}, brows:{type:'thin', color:'#c2a170', y:1, tilt:-1},
   nose:{type:'straight', size:-1}, mouth:{width:'medium', lips:'full'},
   facialHair:'none', details:[], glasses:{type:'none'}, headwear:{type:'none'}, shirt:'#b88d6c', bg:'#e3d9ef'},
];
const ORIGINAL = JSON.parse(JSON.stringify(CAST));
