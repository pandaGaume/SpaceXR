from pathlib import Path
root=Path('C:/Users/GuillaumePelletier/Documents/GitHub/Gaume/spacexr-rendering/examples/babylon-earth')
for f in [root/'src/main.ts',root/'index.html',root/'orbital.html',root/'atmosphere.html']:
    s=f.read_text(encoding='utf-8').replace('Dans l\ufffdatmosph\ufffdre','Dans l’atmosphère').replace('Terre depuis l\ufffdorbite','Terre depuis l’orbite').replace('Atmosph\ufffdre','Atmosphère').replace('SpaceXR dans l\ufffdatmosph\ufffdre','SpaceXR dans l’atmosphère')
    f.write_text(s,encoding='utf-8',newline='\n')
f=root/'src/main.ts';s=f.read_text(encoding='utf-8');old='const scene = createGeospatialScene(engine);'
s=s.replace(old,'engine.useReverseDepthBuffer = true;\n    '+old)
s=s.replace('const resources = runtime.terrain.getStatistics();','const resources = runtime.terrain.getStatistics();\n                const pending = runtime.runtime.instrumentation.snapshot().pendingLoads;')
s=s.replace('"Terre et atmosphère spectrale actives"','(pending > 0 ? `Chargement du relief : ${pending} tâches restantes` : "Terre et atmosphère spectrale actives")')
f.write_text(s,encoding='utf-8',newline='\n')
print('Fixed French captions and enabled reverse depth for sample precision.')
