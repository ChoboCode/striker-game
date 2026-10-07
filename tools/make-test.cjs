// Refresh the development-only review copy from the current game implementation.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const review=path.join(root,'js/__beam_art_review.js');
const previous=fs.readFileSync(review,'utf8');
const start=previous.indexOf('  /* test-only hooks (copy only) */');
const end=previous.indexOf('  boot();',start);
if(start<0 || end<0)throw new Error('Review hooks missing; refusing to overwrite review copy.');
let source=fs.readFileSync(path.join(root,'js/game.js'),'utf8');
source=source.replaceAll('requestAnimationFrame(loop);','if (!window.__NO_RAF) requestAnimationFrame(loop);');
source=source.replace('    if (P.inv > 0) P.inv -= dt;','    if (window.__GOD) P.inv = 99;\n    if (P.inv > 0) P.inv -= dt;');
const hooks=previous.slice(start,end).replace('Bosses.create(stage().boss, G.stageIndex)','Bosses.create(stage().boss, G.stageIndex, mode())');
source=source.replace('  boot();',hooks+'  boot();');
fs.writeFileSync(review,source);
const html=fs.readFileSync(path.join(root,'index.html'),'utf8')
  .replace('<script src="js/assets.js"></script>','<script>window.__NO_RAF = true;</script>\n<script src="js/assets.js"></script>')
  .replace('<script src="js/game.js"></script>','<script src="js/__beam_art_review.js"></script>\n<pre id="SHOT" style="position:fixed;left:-9999px"></pre>\n<pre id="TESTOUT" style="position:fixed;left:-9999px"></pre>\n<script src="tools/harness.js"></script>');
fs.writeFileSync(path.join(root,'__beam_art_review.html'),html);
console.log('Refreshed review copy from current game.js; test hooks remain development-only.');
