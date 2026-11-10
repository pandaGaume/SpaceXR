import "./style.css";
import { createGeospatialRendererEngine,createGeospatialScene } from "@spacexr/3d-tiles-babylon";
import { createEarthRuntime,EARTH_SYSTEM,type IEarthRuntime } from "@spacexr/babylon-earth";
import type { GeospatialCamera } from "@babylonjs/core/Cameras/geospatialCamera.js";
import { Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import { DemPyramid,DemDecoder,webDemTileLoader } from "@spacexr/dem";
import { WebTileSource,WebMercatorTileMetrics } from "@spacexr/tiles";
import { demoImagery } from "./imagery";

declare global { interface Window { earthDemo?:{earth:IEarthRuntime;errors:string[];frames:number;dispose():Promise<void>}; } }
const element=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const status=element<HTMLParagraphElement>("status");
const errors:string[]=[];
function report(error:unknown):void { const text=error instanceof Error?error.message:String(error);errors.push(text);status.textContent=text;document.body.dataset.error="true";console.error(error); }

async function run():Promise<void> {
    const query=new URLSearchParams(location.search),withAtmosphere=query.get("atmosphere")!=="0";
    const canvas=element<HTMLCanvasElement>("earth");
    const {engine,renderer}=await createGeospatialRendererEngine(canvas,query.get("renderer")==="webgl"?"webgl":"webgpu");
    const scene=createGeospatialScene(engine);
    let earth:IEarthRuntime | undefined;
    try {
        const imagery=await demoImagery();
        const demEnabled=query.get("dem")==="1";
        const dem=demEnabled ? new DemPyramid({
            load:webDemTileLoader({source:new WebTileSource({id:"earth-demo-mapzen",urlTemplate:"https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png",
                metrics:new WebMercatorTileMetrics({minLOD:0,maxLOD:15,tileSize:256},EARTH_SYSTEM),registration:"area"}),encoding:"terrarium"},new DemDecoder()),
            maxLOD:15,registration:"area",wrapX:true,cacheEntries:256,
        }):undefined;
        const terrainView=query.get("view")==="terrain";
        earth=await createEarthRuntime(scene,{date:new Date("2026-06-21T12:00:00Z"),
            atmosphere:withAtmosphere ? {}:false,
            camera:{target:terrainView ? {latitudeDegrees:45.8326,longitudeDegrees:6.8652,heightMeters:dem?4808:0}:{latitudeDegrees:25,longitudeDegrees:0},
                radius:terrainView?30000:12000000,pitchRadians:terrainView?Math.PI/3:0,attachControl:true,radiusMin:100},
            terrain:{imagery,...(dem?{elevation:{pyramid:dem}}:{})},onError:report,
        });
        const runtime=earth;
        const camera=runtime.camera as GeospatialCamera;
        const view=(latitude:number,longitude:number,height:number,radius:number,pitch:number):void=>{
            const p=EARTH_SYSTEM.geodeticDegreesToEcef(latitude,longitude,height);
            camera.center=new Vector3(p.x,p.y,p.z);camera.radius=radius;camera.pitch=pitch;
        };
        element<HTMLButtonElement>("orbit").onclick=()=>view(25,0,0,12000000,0);
        element<HTMLButtonElement>("terrain").onclick=()=>{
            if(!demEnabled){query.set("view","terrain");query.set("dem","1");location.search=query.toString();return;}
            view(45.8326,6.8652,4808,30000,Math.PI/3);
        };
        const atmosphere=element<HTMLInputElement>("atmosphere");atmosphere.checked=withAtmosphere;atmosphere.disabled=!withAtmosphere;
        atmosphere.onchange=()=>runtime.setAtmosphereEnabled(atmosphere.checked);
        element<HTMLInputElement>("exposure").oninput=event=>runtime.setExposure(Number((event.target as HTMLInputElement).value));
        const hour=element<HTMLInputElement>("hour");
        hour.oninput=()=>{element<HTMLOutputElement>("time").value=`${hour.value.padStart(2,"0")}:00`;};
        hour.onchange=()=>{status.textContent="Actualisation de la lumière...";void runtime.setDate(new Date(`2026-06-21T${hour.value.padStart(2,"0")}:00:00Z`)).catch(report);};
        element<HTMLElement>("attribution").textContent=demEnabled ? "Relief : Mapzen Terrain Tiles, AWS Open Data. Sources : tilezen/joerd. Imagerie locale de démonstration, provenance historique non qualifiée.":"Imagerie locale de démonstration, provenance historique non qualifiée. Mont Blanc active le relief Mapzen via AWS Open Data.";
        let stopped=false,frameId=0;
        const resize=()=>engine.resize();window.addEventListener("resize",resize);
        const dispose=async()=>{if(stopped)return;stopped=true;cancelAnimationFrame(frameId);window.removeEventListener("resize",resize);await runtime.dispose();scene.dispose();engine.dispose();};
        window.earthDemo={earth:runtime,errors,frames:0,dispose};
        window.addEventListener("pagehide",()=>{void dispose();},{once:true});
        const frame=async():Promise<void>=>{
            if(stopped) return;
            try {
                await runtime.update();if(stopped)return;
                engine.beginFrame();scene.render(false);engine.endFrame();
                window.earthDemo!.frames++;
                const resources=runtime.terrain.getStatistics();
                element<HTMLElement>("stats").textContent=`${renderer} | ${resources.presented} tuiles implicites | ${Math.round(engine.getFps())} FPS`;
                if(!errors.length) status.textContent=withAtmosphere ? (runtime.atmosphereReady?"Terre et atmosphère spectrale actives":"Construction progressive du ciel..."):"Terre active, atmosphère désactivée";
            } catch(error) {report(error);return;}
            frameId=requestAnimationFrame(()=>{void frame();});
        };
        frameId=requestAnimationFrame(()=>{void frame();});
    } catch(error) {await earth?.dispose();scene.dispose();engine.dispose();throw error;}
}
void run().catch(report);
