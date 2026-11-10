from pathlib import Path
import json
root=Path('C:/Users/GuillaumePelletier/Documents/GitHub/Gaume/spacexr-rendering');example=root/'examples/babylon-earth'
f=example/'src/main.ts';s=f.read_text()
s=s.replace('async function run(): Promise<void> {','export type EarthDemoView = "orbit" | "atmosphere";\n\nasync function run(initialView: EarthDemoView): Promise<void> {')
s=s.replace('const demEnabled = query.get("dem") === "1";','const inside = query.get("view") === "terrain" || query.get("view") === "atmosphere" || (initialView === "atmosphere" && query.get("view") !== "orbit");\n        const demEnabled = query.get("dem") === "1" || (inside && query.get("dem") !== "0");')
s=s.replace('const terrainView = query.get("view") === "terrain";','const terrainView = inside;\n        document.querySelector("h1")!.textContent = inside ? "Dans l’atmosphère" : "Terre depuis l’orbite";')
s=s.replace('radius: terrainView ? 30000 : 12000000,','radius: terrainView ? 35000 : 12000000,').replace('pitchRadians: terrainView ? Math.PI / 3 : 0,','pitchRadians: terrainView ? (80 * Math.PI / 180) : 0,')
s=s.replace('view(45.8326, 6.8652, 4808, 30000, Math.PI / 3);','view(45.8326, 6.8652, 4808, 35000, 80 * Math.PI / 180);')
s=s.replace('void run().catch(report);','export function startEarthDemo(view: EarthDemoView): void { void run(view).catch(report); }')
f.write_text(s)
for entry,view in [('orbital','orbit'),('atmospheric','atmosphere')]:
    (example/f'src/{entry}.ts').write_text(f'import {{ startEarthDemo }} from "./main";\nstartEarthDemo("{view}");\n')
template=(example/'index.html').read_text().replace('/src/main.ts','/src/orbital.ts').replace('id="terrain">Mont Blanc','id="terrain">Atmosphère')
(example/'index.html').write_text(template)
(example/'orbital.html').write_text(template.replace('<title>SpaceXR Terre</title>','<title>SpaceXR Terre orbitale</title>'))
(example/'atmosphere.html').write_text(template.replace('/src/orbital.ts','/src/atmospheric.ts').replace('<title>SpaceXR Terre</title>','<title>SpaceXR dans l’atmosphère</title>'))
f=example/'vite.config.ts';s=f.read_text().replace('build: { target: "es2022", sourcemap: true },','''build: { target: "es2022", sourcemap: true, rollupOptions: { input: {
        index: fileURLToPath(new URL("index.html",import.meta.url)),
        orbital: fileURLToPath(new URL("orbital.html",import.meta.url)),
        atmosphere: fileURLToPath(new URL("atmosphere.html",import.meta.url)),
    } } },''');f.write_text(s)
f=root/'package.json';d=json.loads(f.read_text());d['scripts'].update({'example:earth:orbit':'npm run dev --workspace @spacexr/example-babylon-earth -- --open /orbital.html','example:earth:atmosphere':'npm run dev --workspace @spacexr/example-babylon-earth -- --open /atmosphere.html'});f.write_text(json.dumps(d,indent=4)+'\n')
print('Two independent HTML and TypeScript entry points created.')
