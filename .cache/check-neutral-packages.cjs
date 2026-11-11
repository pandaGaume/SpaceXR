const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const base = 'C:/Users/GuillaumePelletier/Documents/GitHub/Gaume';
const packages = ['3d-tiles-core/node/packages/core','3d-tiles-core/node/packages/tiles','3d-tiles-core/node/packages/runtime','terrain-core/packages/raster','terrain-core/packages/dem','terrain-core/packages/grid','spacexr-rendering/packages/core'];
for (const dir of packages) {
  const result = JSON.parse(cp.execSync('npm pack --dry-run --json --ignore-scripts', {cwd:path.join(base,dir),encoding:'utf8',stdio:['ignore','pipe','pipe']}))[0];
  const files = result.files.map(f=>f.path);
  if (!files.some(f=>f.endsWith('.js')) || !files.some(f=>f.endsWith('.d.ts'))) throw Error('Missing build: '+dir);
  if (files.some(f=>/(^|\/)(cube|lunar|moon)(\/|\.)/i.test(f))) throw Error('Retired payload: '+dir);
  console.log(result.name+': JS, declarations and neutral payload verified');
}
for (const repo of ['3d-tiles-core','terrain-core','spacexr-rendering']) {
  const root=path.join(base,repo);
  const files=[path.join(root,'README.md')];
  const docs=path.join(root,'docs');
  if(fs.existsSync(docs)) for(const f of fs.readdirSync(docs)) if(f.endsWith('.md')) files.push(path.join(docs,f));
  for(const file of files) for(const match of fs.readFileSync(file,'utf8').matchAll(/\]\(([^)]+)\)/g)) {
    const href=match[1].split('#')[0];
    if(!href || /^\w+:/.test(href)) continue;
    if(!fs.existsSync(path.resolve(path.dirname(file),decodeURIComponent(href)))) console.log('BROKEN '+file+' -> '+href);
  }
  for(const file of fs.readdirSync(root).filter(f=>f.endsWith('.code-workspace'))) {
    const workspace=JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
    for(const folder of workspace.folders) if(!fs.existsSync(path.resolve(root,folder.path))) throw Error('Missing workspace folder '+folder.path);
  }
}
