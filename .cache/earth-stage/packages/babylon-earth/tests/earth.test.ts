import {describe,it,expect} from "vitest";
import {NullEngine} from "@babylonjs/core/Engines/nullEngine.js";
import {Scene} from "@babylonjs/core/scene.js";
import {FreeCamera} from "@babylonjs/core/Cameras/freeCamera.js";
import {Vector3} from "@babylonjs/core/Maths/math.vector.js";
import {SolarSystemBodies} from "@spacexr/celestial-core/catalog";
import {TileRuntime} from "@spacexr/3d-tiles-runtime";
import {createEarthRuntime,EARTH_SYSTEM,earthSunDirection} from "../src";
import {earthAtmosphere} from "../src/earth-model";
import {atmosphereCamera} from "../src/atmosphere/camera";

describe("Earth composition",()=>{
    it("uses Celestial shape and gravity for the existing atmosphere model",()=>{
        const model=earthAtmosphere(new Date("2026-06-21T12:00:00Z"));
        expect(EARTH_SYSTEM.ellipsoid).toBe(SolarSystemBodies.Earth!.ellipsoid);
        expect(model.ellipsoid.semiMajorAxis).toBe(EARTH_SYSTEM.ellipsoid.semiMajorAxis);
        expect(model.layers[0]!.gas!.gravity).toBe(SolarSystemBodies.Earth!.gravity.value);
        expect(model.layers[0]!.optics(450).rayleigh).toBeGreaterThan(model.layers[0]!.optics(650).rayleigh);
    });
    it("converts Celestial observer directions into ECEF and rejects invalid dates",()=>{
        const noon=earthSunDirection(new Date("2026-03-20T12:00:00Z"));
        const midnight=earthSunDirection(new Date("2026-03-20T00:00:00Z"));
        expect(noon[0]).toBeGreaterThan(0.99);expect(midnight[0]).toBeLessThan(-0.99);
        expect(Math.hypot(...noon)).toBeCloseTo(1,12);
        expect(()=>earthSunDirection(new Date(NaN))).toThrow();
    });
    it("captures right-handed camera rays without ECEF rebasing",()=>{
        const engine=new NullEngine();const scene=new Scene(engine);scene.useRightHandedSystem=true;
        const camera=new FreeCamera("view",new Vector3(7000000,0,0),scene);camera.upVector=Vector3.Forward();camera.setTarget(Vector3.Zero());
        const frame=atmosphereCamera(camera,800,600);
        expect(frame.positionEcefMeters[0]).toBe(7000000);expect(frame.forwardEcef[0]).toBeCloseTo(-1);
        const cross=Vector3.Cross(Vector3.FromArray(frame.rightEcef),Vector3.FromArray(frame.upEcef));
        expect(Vector3.Dot(cross,Vector3.FromArray(frame.forwardEcef))).toBeCloseTo(-1);
        scene.dispose();engine.dispose();
    });
    it("drives the actual TileRuntime and preserves borrowed scene and camera on disposal",async()=>{
        const engine=new NullEngine();const scene=new Scene(engine);scene.useRightHandedSystem=true;
        const camera=new FreeCamera("borrowed",new Vector3(15000000,0,0),scene);camera.setTarget(Vector3.Zero());
        const labels={ownerDocument:{createElement:()=>({style:{setProperty(){}},remove(){}})},append(){}} as unknown as HTMLElement;
        const earth=await createEarthRuntime(scene,{existingCamera:camera,labelLayer:labels,atmosphere:false,terrain:{minLOD:1,maxLOD:1,cells:4}});
        expect(earth.runtime).toBeInstanceOf(TileRuntime);
        for(let i=0;i<8;i++) await earth.update();
        await earth.dispose();await earth.dispose();
        expect(scene.isDisposed).toBe(false);expect(scene.cameras).toContain(camera);expect(scene.meshes).toHaveLength(0);expect(scene.lights).toHaveLength(0);
        await expect(earth.update()).rejects.toThrow("disposed");
        scene.dispose();engine.dispose();
    });
    it("fails explicitly when atmospheric rendering is requested on WebGL",async()=>{
        const engine=new NullEngine();const scene=new Scene(engine);scene.useRightHandedSystem=true;
        const camera=new FreeCamera("borrowed",new Vector3(15000000,0,0),scene);
        await expect(createEarthRuntime(scene,{existingCamera:camera,labelLayer:{} as HTMLElement})).rejects.toThrow("WebGPU");
        expect(scene.lights).toHaveLength(0);expect(scene.meshes).toHaveLength(0);expect(scene.cameras).toContain(camera);
        scene.dispose();engine.dispose();
    });
});
