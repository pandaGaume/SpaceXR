from pathlib import Path
root=Path('C:/Users/GuillaumePelletier/Documents/GitHub/Gaume/spacexr-rendering')
f=root/'packages/babylon-earth/src/atmosphere/babylon-sky.ts';s=f.read_text(encoding='utf-8').replace('options.exposure ?? 12','options.exposure ?? (options.aerialPerspective === false ? 12 : 4)').replace('Display exposure, default 12.','Display exposure, default 4 for HDR composition.');f.write_text(s,encoding='utf-8',newline='\n')
f=root/'packages/babylon-earth/src/earth-runtime.ts';s=f.read_text(encoding='utf-8').replace('(options.atmosphere?.exposure ?? 12)','(options.atmosphere?.exposure ?? (options.atmosphere?.aerialPerspective === false ? 12 : 4))');f.write_text(s,encoding='utf-8',newline='\n')
f=root/'examples/babylon-earth/src/main.ts';s=f.read_text(encoding='utf-8').replace(': { latitudeDegrees: 25, longitudeDegrees: 0 },',': horizonView ? {latitudeDegrees:30,longitudeDegrees:-30} : { latitudeDegrees: 25, longitudeDegrees: 0 },').replace('horizonView ? 800000 : 12000000','horizonView ? 1800000 : 12000000').replace('horizonView ? Math.PI/3 : 0','horizonView ? 85*Math.PI/180 : 0').replace('view(25,0,0,800000,Math.PI/3);','view(30,-30,0,1800000,85*Math.PI/180);');f.write_text(s,encoding='utf-8',newline='\n')
for name in ['index.html','orbital.html','atmosphere.html']:
    f=root/'examples/babylon-earth'/name;s=f.read_text(encoding='utf-8').replace('max="30" value="12"','max="30" value="4"');f.write_text(s,encoding='utf-8',newline='\n')
print('Calibrated HDR display exposure without changing physical optics, and set the horizon camera near 400 km.')
