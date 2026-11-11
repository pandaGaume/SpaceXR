from pathlib import Path
root=Path('C:/Users/GuillaumePelletier/Documents/GitHub/Gaume/spacexr-rendering/examples/babylon-earth')
f=root/'src/dem-decoder.worker.ts';f.write_text('''/// <reference lib="webworker" />
import { installDemDecoderWorker, type IDemWorkerScope } from "@spacexr/dem";
installDemDecoderWorker(self as unknown as IDemWorkerScope);
''',encoding='utf-8',newline='\n')
f=root/'src/main.ts';s=f.read_text(encoding='utf-8').replace('type IEarthRuntime }','earthSunDirection, type IEarthRuntime }').replace('LocalDemDecoder','WorkerDemDecoder, type IDemWorkerEndpoint')
s=s.replace('import { demoImagery }','import DemDecoderWorker from "./dem-decoder.worker?worker";\nimport { demoImagery }')
s=s.replace('new WorkerDemDecoder, type IDemWorkerEndpoint()', 'decoder!')
s=s.replace('    let earth: IEarthRuntime | undefined;','    let earth: IEarthRuntime | undefined;\n    let decoder: WorkerDemDecoder | undefined;')
s=s.replace('        const dem = demEnabled','''        if (demEnabled) decoder = new WorkerDemDecoder(Array.from({length:Math.max(1,Math.min(2,navigator.hardwareConcurrency ?? 2))},()=>new DemDecoderWorker() as unknown as IDemWorkerEndpoint));
        const dem = demEnabled''')
s=s.replace('            await runtime.dispose();','            await runtime.dispose();\n            decoder?.terminate();').replace('        await earth?.dispose();','        await earth?.dispose();\n        decoder?.terminate();')
start=s.index('        hour.oninput =');end=s.index('        element<HTMLElement>("attribution")',start)
s=s[:start]+'''        const dateAt = (hours:number) => new Date(Date.UTC(2026,5,21)+hours*3600000);
        const showTime = (date:Date) => {
            hour.value=String(date.getUTCHours()+date.getUTCMinutes()/60);
            element<HTMLOutputElement>("time").value=date.toISOString().slice(11,16);
        };
        hour.oninput=()=>showTime(dateAt(Number(hour.value)));
        hour.onchange=()=>{status.textContent="Actualisation de la lumière...";void runtime.setDate(dateAt(Number(hour.value))).catch(report);};
        const sunset = async ():Promise<void> => {
            if (!inside) {location.href="/atmosphere.html?sunset=1";return;}
            let date=dateAt(19);
            for(let iteration=0;iteration<3;iteration++) {
                camera.pitch=85*Math.PI/180;camera.update();camera.getViewMatrix(true);
                const geo=EARTH_SYSTEM.ecefToGeodeticRadians(camera.globalPosition);
                const local=EARTH_SYSTEM.createLocalTangentPlaneDegrees(geo.latitude*180/Math.PI,geo.longitude*180/Math.PI).basis;
                const horizon=-Math.acos(EARTH_SYSTEM.ellipsoid.semiMajorAxis/(EARTH_SYSTEM.ellipsoid.semiMajorAxis+Math.max(1,geo.height)));
                let low=12,high=24;
                for(let n=0;n<32;n++) {
                    const middle=(low+high)/2,sun=earthSunDirection(dateAt(middle));
                    const elevation=Math.asin(sun[0]*local.up.x+sun[1]*local.up.y+sun[2]*local.up.z);
                    if(elevation>horizon+0.35*Math.PI/180)low=middle;else high=middle;
                }
                date=dateAt((low+high)/2);
                const sun=Vector3.FromArray(earthSunDirection(date));
                camera.yaw=Math.atan2(sun.x*local.east.x+sun.y*local.east.y+sun.z*local.east.z,sun.x*local.north.x+sun.y*local.north.y+sun.z*local.north.z);
            }
            showTime(date);status.textContent="Préparation du coucher de soleil...";
            await runtime.setDate(date);
        };
        element<HTMLButtonElement>("sunset").onclick=()=>{void sunset().catch(report);};
        if (query.get("sunset")==="1") await sunset();
'''+s[end:]
f.write_text(s,encoding='utf-8',newline='\n')
for name in ['index.html','orbital.html','atmosphere.html']:
    f=root/name;s=f.read_text(encoding='utf-8').replace('max="23" value="12"','max="23.983333" step="0.016667" value="12"').replace('<label>Exposition','<button id="sunset">Coucher de soleil</button>\n            <label>Exposition');f.write_text(s,encoding='utf-8',newline='\n')
print('Added solar-facing sunset preset and off-main-thread DEM decoding.')
