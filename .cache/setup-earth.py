from pathlib import Path
import json,shutil
stage=Path(__file__).parent/'earth-stage'
base=Path('C:/Users/GuillaumePelletier/Documents/GitHub/Gaume')
render=base/'spacexr-rendering'
pkg=stage/'packages/babylon-earth'
def write(path,text):
    path.parent.mkdir(parents=True,exist_ok=True)
    assert '\u2014' not in text
    path.write_text(text,encoding='utf-8')
def js(path,data):write(path,json.dumps(data,indent=4)+'\n')
template=json.loads((render/'packages/core/package.json').read_text())
template.update(name='@spacexr/babylon-earth',description='Earth composition for Babylon using Celestial, the SpaceXR 3D Tiles runtime and spectral atmosphere.',keywords=['earth','babylonjs','atmosphere','3d-tiles'])
template['repository']['directory']='packages/babylon-earth'
template['scripts'].update(shaders='node scripts/build-shader.mjs',prebuild='npm run shaders',typecheck='npm run shaders && tsc -p tsconfig.json --noEmit')
for k in ['shaders:check','shaders:watch']:template['scripts'].pop(k,None)
template['dependencies'].update({'@spacexr/3d-tiles-babylon':'0.1.0','@spacexr/celestial-core':'0.1.0','@spacexr/atmosphere':'0.1.0','@webgpu/types':'^0.1.74'})
template['peerDependencies']={'@babylonjs/core':'^9.33.1'}
template.pop('peerDependenciesMeta',None)
js(pkg/'package.json',template)
for name in ['tsconfig.json','.eslintrc.json','vitest.config.ts','LICENSE']:
    source=render/'packages/core'/name
    if source.exists():write(pkg/name,source.read_text())
write(pkg/'tsup.config.ts','''import { defineConfig } from "tsup";
export default defineConfig({ entry:{index:"src/index.ts"},format:["esm"],target:"es2022",dts:true,sourcemap:true,clean:true,treeshake:true,external:[/^@babylonjs\\//,/^@spacexr\\//] });
''')
write(pkg/'scripts/build-shader.mjs','''import {readFileSync,writeFileSync,mkdirSync} from "node:fs";
const source=new URL("../src/atmosphere/display.wgsl",import.meta.url);
const target=new URL("../src/atmosphere/generated/",import.meta.url);
mkdirSync(target,{recursive:true});
writeFileSync(new URL("display.ts",target),"// Generated from display.wgsl. Run npm run shaders.\\nexport const displayShader = "+JSON.stringify(readFileSync(source,"utf8"))+";\\n");
''')
example=stage/'examples/babylon-earth'
sample=json.loads((render/'examples/babylon-implicit-grid-mapzen/package.json').read_text())
sample['name']='@spacexr/example-babylon-earth'
sample['description']='Standalone Earth, implicit terrain and spectral atmosphere example.'
sample['dependencies'].update({'@spacexr/babylon-earth':'0.1.0'})
sample['scripts'].pop('test',None)
js(example/'package.json',sample)
config=json.loads((render/'examples/babylon-implicit-grid-mapzen/tsconfig.json').read_text())
config['compilerOptions']['paths']={'@spacexr/babylon-earth':['../../packages/babylon-earth/src/index.ts'],'@spacexr/3d-tiles-babylon':['../../packages/core/src/index.ts']}
config['include']=['src/**/*.ts','vite.config.ts']
js(example/'tsconfig.json',config)
write(example/'.eslintrc.json',(render/'examples/babylon-implicit-grid-mapzen/.eslintrc.json').read_text())
write(example/'vite.config.ts','''import {defineConfig} from "vite";
import {fileURLToPath} from "node:url";
export default defineConfig({resolve:{preserveSymlinks:true,dedupe:["@babylonjs/core","@spacexr/geodesy"],alias:{
"@spacexr/babylon-earth":fileURLToPath(new URL("../../packages/babylon-earth/src/index.ts",import.meta.url)),
"@spacexr/3d-tiles-babylon":fileURLToPath(new URL("../../packages/core/src/index.ts",import.meta.url))}},
server:{port:5180,host:"127.0.0.1",open:false,fs:{allow:[fileURLToPath(new URL("../../..",import.meta.url))]}},
optimizeDeps:{exclude:["@spacexr/babylon-earth","@spacexr/3d-tiles-babylon","@spacexr/3d-tiles-runtime","@spacexr/atmosphere","@spacexr/celestial-core"]},
build:{target:"es2022",sourcemap:true}});
''')
write(example/'index.html','''<!doctype html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SpaceXR Terre</title></head>
<body><canvas id="earth"></canvas><aside><h1>Terre</h1><p id="status">Initialisation...</p>
<nav><button id="orbit">Orbite</button><button id="terrain">Mont Blanc</button></nav>
<label><input id="atmosphere" type="checkbox" checked> Atmosphère</label>
<label>Heure UTC <input id="hour" type="range" min="0" max="23" value="12"><output id="time">12:00</output></label>
<label>Exposition <input id="exposure" type="range" min="1" max="30" value="12"></label>
<p>Glisser pour naviguer, molette pour zoomer.</p><p id="attribution"></p><p id="stats"></p></aside><script type="module" src="/src/main.ts"></script></body></html>
''')
write(example/'src/style.css','''html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#020408;color:#edf4fc;font:14px system-ui}#earth{width:100%;height:100%;display:block;touch-action:none}aside{position:absolute;left:20px;top:20px;width:245px;padding:20px;background:#0b1428df;border:1px solid #6584a855;border-radius:12px}h1{margin:0 0 12px;font-size:26px}label{display:block;margin:16px 0}input[type=range]{display:block;width:100%;margin-top:8px}button{background:#244168;color:inherit;border:1px solid #6e9ac6;border-radius:5px;padding:8px 12px;cursor:pointer}nav{display:flex;gap:8px}p{line-height:1.5}#attribution,#stats{font-size:11px;color:#a8bfd8}body[data-error=true] #status{color:#ffb4a4}
''')
dest=example/'public/textures';dest.mkdir(parents=True,exist_ok=True)
shutil.copy2(base/'spacexr-explorer/public/textures/earth_map.jpg',dest/'earth_map.jpg')
write(dest/'README.md','''Legacy Earth visual asset reused from spacexr-explorer/public/textures/earth_map.jpg, originally SpaceXR/packages/host/www/images/planets/earth_map.jpg. Acquisition date, original source and registration are unverified. Demonstration imagery only, not a DEM or scientific reference. No external asset was fetched.
''')
print('Package and sample staged.')
