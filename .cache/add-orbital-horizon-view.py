from pathlib import Path
root=Path('C:/Users/GuillaumePelletier/Documents/GitHub/Gaume/spacexr-rendering/examples/babylon-earth')
f=root/'src/main.ts';s=f.read_text(encoding='utf-8').replace('        const terrainView = inside;','        const terrainView = inside;\n        const horizonView=query.get("view")==="horizon";')
s=s.replace('atmosphere: withAtmosphere ? {} : false,','atmosphere: withAtmosphere ? {aerialPerspective:query.get("aerial")!=="0"} : false,')
s=s.replace('radius: terrainView ? 35000 : 12000000,','radius: terrainView ? 35000 : horizonView ? 800000 : 12000000,').replace('pitchRadians: terrainView ? (80 * Math.PI) / 180 : 0,','pitchRadians: terrainView ? (80 * Math.PI) / 180 : horizonView ? Math.PI/3 : 0,\n                yawRadians:horizonView ? 1.1 : 0,')
marker='        element<HTMLButtonElement>("terrain").onclick = () => {'
s=s.replace(marker,'''        element<HTMLButtonElement>("horizon").onclick = () => {
            if(inside){location.href="/orbital.html?view=horizon&sse="+sse;return;}
            view(25,0,0,800000,Math.PI/3);camera.yaw=1.1;
        };
'''+marker);f.write_text(s,encoding='utf-8',newline='\n')
for name in ['index.html','orbital.html','atmosphere.html']:
    f=root/name;s=f.read_text(encoding='utf-8').replace('<button id="orbit">Orbite</button>','<button id="orbit">Orbite</button><button id="horizon">Horizon orbital</button>');f.write_text(s,encoding='utf-8',newline='\n')
f=root/'src/style.css';s=f.read_text(encoding='utf-8');s+='\nnav { flex-wrap: wrap; }\n';f.write_text(s,encoding='utf-8',newline='\n')
print('Added a near-horizon orbital view for the requested atmospheric effect.')
