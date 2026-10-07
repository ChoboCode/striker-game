const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
for(const dir of ['js','tools']){
  for(const name of fs.readdirSync(path.join(root,dir)).filter(name=>/\.(js|cjs)$/.test(name))){
    new vm.Script(fs.readFileSync(path.join(root,dir,name),'utf8'),{filename:name});
  }
}
const items=JSON.parse(fs.readFileSync(path.join(root,'assets/seven-stage-imagegen-v1.json'),'utf8'));
assert.equal(items.length,8);
for(const asset of items){
  assert.ok(fs.statSync(path.join(root,'assets',asset.file)).size>1000,asset.file+' is saved');
  assert.ok(asset.prompt && asset.tool==='built-in image_gen');
  assert.ok(fs.statSync(path.join(root,'../output/imagegen/seven-stage-v1',asset.key+'-source.png')).size>1000,asset.key+' source preserved');
}
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const preview=fs.readFileSync(path.join(root,'tools/boss-patterns.html'),'utf8');
for(const match of preview.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))if(match[1].trim())new vm.Script(match[1],{filename:'boss-patterns.html'});
const previewIds=[...preview.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(previewIds).size,previewIds.length);
for(const asset of JSON.parse(fs.readFileSync(path.join(root,'assets/phase-variety-imagegen-v1.json'),'utf8'))){
  assert.ok(fs.statSync(path.join(root,'assets',asset.file)).size>1000,asset.file+' saved');
  assert.ok(asset.prompt && asset.tool==='built-in image_gen');
}
const ground=JSON.parse(fs.readFileSync(path.join(root,'assets/ground/imagegen-v1.json'),'utf8'));
assert.equal(ground.length,9);
for(const asset of ground){
  assert.ok(fs.statSync(path.join(root,'assets/ground',asset.file)).size>1000,asset.file+' saved');
  assert.ok(asset.prompt&&asset.tool==='built-in image_gen');
  assert.ok(fs.statSync(path.join(root,'../output/imagegen/ground-v1',asset.key+'-source.png')).size>1000,asset.key+' original preserved');
  if(asset.runtimeFile)assert.ok(fs.statSync(path.join(root,'assets/ground',asset.runtimeFile)).size>1000,asset.runtimeFile+' runtime saved');
}
const groundPreview=fs.readFileSync(path.join(root,'tools/ground-art.html'),'utf8');
for(const match of groundPreview.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))if(match[1].trim())new vm.Script(match[1],{filename:'ground-art.html'});
const groundIds=[...groundPreview.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(groundIds).size,groundIds.length);
const destructionPreview=fs.readFileSync(path.join(root,'tools/boss-destruction.html'),'utf8');
for(const match of destructionPreview.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))if(match[1].trim())new vm.Script(match[1],{filename:'boss-destruction.html'});
const destructionIds=[...destructionPreview.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(destructionIds).size,destructionIds.length);
for(const match of destructionPreview.matchAll(/(?:src|href)="(\.\.\/[^"?#]+)"/g))assert.ok(fs.existsSync(path.resolve(root,'tools',match[1])),match[1]);
const destruction=JSON.parse(fs.readFileSync(path.join(root,'assets/boss-destruction-imagegen-v1.json'),'utf8'));
assert.equal(destruction.length,3);
for(const asset of destruction){
  assert.ok(asset.prompt&&asset.tool==='built-in image_gen');
  assert.ok(fs.statSync(path.join(root,'assets',asset.file)).size>1000,asset.file+' runtime saved');
  assert.ok(fs.statSync(path.join(root,'../output/imagegen/boss-destruction-v1',asset.key+'-source.png')).size>1000,asset.key+' source preserved');
}
const loading=JSON.parse(fs.readFileSync(path.join(root,'assets/boss-destruction-loading-v1.json'),'utf8'));
assert.ok(loading.existingAfterBytes<loading.existingBeforeBytes);
assert.ok([...loading.generated,...loading.optimized].every(item=>item.alphaPreserved));
const revised=JSON.parse(fs.readFileSync(path.join(root,'assets/boss-destruction-imagegen-v2.json'),'utf8'));
assert.equal(revised.length,3);
for(const asset of revised){
  assert.ok(asset.prompt&&asset.tool==='built-in image_gen');
  assert.ok(fs.statSync(path.join(root,'assets',asset.file)).size>1000);
  assert.ok(fs.statSync(path.join(root,'../output/imagegen/boss-destruction-v2',asset.key+'-source.png')).size>1000);
}
const revisedLoading=JSON.parse(fs.readFileSync(path.join(root,'assets/boss-destruction-loading-v2.json'),'utf8'));
assert.ok(revisedLoading.generated.every(item=>item.alphaPreserved));
const flameOnly=JSON.parse(fs.readFileSync(path.join(root,'assets/boss-destruction-imagegen-v3.json'),'utf8'));
assert.equal(flameOnly.length,3);
for(const asset of flameOnly){
  assert.ok(asset.prompt&&asset.tool==='built-in image_gen');
  assert.ok(fs.statSync(path.join(root,'assets',asset.file)).size>1000);
  assert.ok(fs.statSync(path.join(root,'../output/imagegen/boss-destruction-v3',asset.key+'-source.png')).size>1000);
}
const flameLoading=JSON.parse(fs.readFileSync(path.join(root,'assets/boss-destruction-loading-v3.json'),'utf8'));
assert.ok(flameLoading.generated.every(item=>item.alphaPreserved));
const damage=JSON.parse(fs.readFileSync(path.join(root,'assets/boss-damage-imagegen-v1.json'),'utf8'));
assert.equal(damage.length,3);
for(const asset of damage){
  assert.ok(asset.prompt&&asset.tool==='built-in image_gen');
  assert.ok(fs.statSync(path.join(root,'assets',asset.file)).size>1000);
  assert.ok(fs.statSync(path.join(root,'../output/imagegen/boss-damage-v1',asset.key+'-source.png')).size>1000);
}
const damageLoading=JSON.parse(fs.readFileSync(path.join(root,'assets/boss-damage-loading-v1.json'),'utf8'));
assert.ok(damageLoading.generated.every(item=>item.alphaPreserved));
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
assert.equal(new Set(ids).size,ids.length,'HTML IDs are unique');
for(const match of html.matchAll(/(?:src|href)="((?:js|css|assets)\/[^"?#]+)"/g))assert.ok(fs.existsSync(path.join(root,match[1])),match[1]);
console.log('PASS JS and preview script syntax, thirty-one saved ImageGen assets, original copies, runtime compression, unique HTML IDs and local references');
