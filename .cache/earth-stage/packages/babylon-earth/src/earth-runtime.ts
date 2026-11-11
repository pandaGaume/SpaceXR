import type { Camera } from "@babylonjs/core/Cameras/camera.js";
import type { GeospatialCamera } from "@babylonjs/core/Cameras/geospatialCamera.js";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight.js";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight.js";
import { Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import { Color3 } from "@babylonjs/core/Maths/math.color.js";
import type { Scene } from "@babylonjs/core/scene.js";
import { BabylonRasterPages, BabylonRuntimeDriver, MeshTerrainEngine, createGeodesicGridSource, createGeospatialCamera, webMercatorTiling,
    type IBabylonRasterPagesOptions, type IBabylonGeodesicGridHandle, type IGeospatialCameraOptions, type IGridElevationOptions } from "@spacexr/3d-tiles-babylon";
import { DenseImplicitSubtreeLoader,EcefSpatialMetric,TileRuntime,WebMercatorTileMetrics,type IEcefCameraFrame,type IEcefSpatialState,type IRuntimeAdapter } from "@spacexr/3d-tiles-runtime";
import type { IPhysicalAtmosphereConfig } from "@spacexr/atmosphere";
import { BabylonEarthSky,type IEarthAtmosphereOptions } from "./atmosphere/babylon-sky";
import { EARTH,EARTH_SYSTEM,earthAtmosphere,earthSunDirection } from "./earth-model";
import { EarthTerrainAdapter } from "./terrain-adapter";

export type EarthTileRuntime=TileRuntime<IEcefCameraFrame,IEcefSpatialState,IBabylonGeodesicGridHandle,never>;
export interface IEarthRuntimeOptions {
    camera?: Omit<IGeospatialCameraOptions,"geodeticSystem">;
    /** Borrow an existing ECEF camera instead of creating one. */
    existingCamera?: Camera;
    /** Browser DOM layer for optional tile labels. An owned hidden layer is created when omitted. */
    labelLayer?: HTMLElement;
    date?: Date;
    atmosphere?: false | (IEarthAtmosphereOptions & {physical?: Omit<IPhysicalAtmosphereConfig,"ellipsoid"|"gravity"|"planet">});
    terrain?: { cells?: number; minLOD?: number; maxLOD?: number; screenSpaceError?: number; elevation?: IGridElevationOptions; imagery?: IBabylonRasterPagesOptions; };
    onError?: (error:unknown)=>void;
}
export interface IEarthRuntime {
    readonly body: typeof EARTH;
    readonly geodeticSystem: typeof EARTH_SYSTEM;
    readonly camera: Camera;
    readonly runtime: EarthTileRuntime;
    readonly terrain: MeshTerrainEngine;
    readonly atmosphereReady: boolean;
    /** Updates camera, tile selection and sky before the caller's scene.render(false). Never starts a render loop. */
    update(): Promise<void>;
    setDate(date: Date): Promise<void>;
    setAtmosphereEnabled(enabled:boolean):void;
    setExposure(exposure:number):void;
    /** Disposes owned resources, preserving the borrowed scene, engine and existingCamera. */
    dispose(): Promise<void>;
}

export async function createEarthRuntime(scene:Scene,options:IEarthRuntimeOptions={}):Promise<IEarthRuntime> {
    if(!scene.useRightHandedSystem) throw new Error("Earth runtime requires a right-handed ECEF scene. Use createGeospatialScene.");
    if(options.camera && options.existingCamera) throw new Error("Choose camera options or existingCamera.");
    let date=new Date(options.date?.getTime() ?? Date.now());
    earthSunDirection(date);
    const config=options.terrain ?? {};
    const cells=config.cells ?? 32,minLOD=config.minLOD ?? 1,maxLOD=config.maxLOD ?? 16,sse=config.screenSpaceError ?? 12;
    if(!Number.isInteger(cells) || cells<2 || cells>256 || !Number.isInteger(minLOD) || minLOD<0 || minLOD>6 || !Number.isInteger(maxLOD) || maxLOD<minLOD || maxLOD>24 || !Number.isFinite(sse) || sse<=0)
        throw new RangeError("Invalid Earth terrain grid, LOD range or screen-space error.");
    const previousCamera=scene.activeCamera;
    let camera:Camera | undefined;
    let ownedCamera:GeospatialCamera | undefined;
    let ownedLabels:HTMLElement | undefined;
    let pages:BabylonRasterPages | undefined;
    let terrain:MeshTerrainEngine | undefined;
    let runtime:EarthTileRuntime | undefined;
    let driver:BabylonRuntimeDriver | undefined;
    let sky:BabylonEarthSky | undefined;
    let sunlight:DirectionalLight | undefined;
    let ambient:HemisphericLight | undefined;
    let disposed=false;
    let updating:Promise<void> | undefined;
    let dateRevision=0;
    const atmosphereOptions=options.atmosphere === false ? undefined : options.atmosphere ?? {};
    const dispose=async():Promise<void>=>{
        if(disposed) return;
        disposed=true;dateRevision++;
        scene.onDisposeObservable.remove(disposeObserver);
        await updating?.catch(()=>undefined);
        driver?.dispose();
        await runtime?.dispose();
        terrain?.dispose(); pages?.dispose(); sky?.dispose(); sunlight?.dispose(); ambient?.dispose();
        if(scene.activeCamera===ownedCamera) scene.activeCamera=previousCamera;
        ownedCamera?.dispose(); ownedLabels?.remove();
    };
    const disposeObserver=scene.onDisposeObservable.add(()=>{void dispose();});
    try {
        camera=options.existingCamera ?? (ownedCamera=createGeospatialCamera(scene,{
            target:{latitudeDegrees:25,longitudeDegrees:0},radius:12000000,...options.camera,geodeticSystem:EARTH_SYSTEM,
        }));
        scene.activeCamera=camera;
        if(!options.labelLayer) {
            if(typeof document==="undefined") throw new Error("Pass labelLayer when creating Earth runtime outside a browser.");
            ownedLabels=document.createElement("div");ownedLabels.hidden=true;
        }
        if(atmosphereOptions) sky=await BabylonEarthSky.create(scene,earthAtmosphere(date,atmosphereOptions.physical),atmosphereOptions);
        const direction=Vector3.FromArray(earthSunDirection(date));
        sunlight=new DirectionalLight("earth-sun",direction.negate(),scene);sunlight.intensity=1.5;
        ambient=new HemisphericLight("earth-ambient",Vector3.Up(),scene);ambient.intensity=0.12;
        ambient.groundColor=new Color3(0.01,0.015,0.025);
        pages=config.imagery ? new BabylonRasterPages(scene,config.imagery):undefined;
        terrain=new MeshTerrainEngine({scene,labelLayer:options.labelLayer ?? ownedLabels!,wireframe:false,lighting:"terrain",
            junctions:"fine",edgeHeights:"coarsest",geometrySelection:"runtime",tiling:webMercatorTiling(EARTH_SYSTEM),
            ...(config.elevation ? {elevation:config.elevation}:{}),...(pages ? {imageryPages:pages}:{}),
        },{cells,maxDrapeDepth:0});
        const source=createGeodesicGridSource(undefined,{id:"earth-terrain",metrics:new WebMercatorTileMetrics({minLOD,maxLOD,tileSize:cells},EARTH_SYSTEM)});
        const adapter=new EarthTerrainAdapter(terrain,pages);
        const ports:IRuntimeAdapter<IEcefCameraFrame,IEcefSpatialState,IBabylonGeodesicGridHandle,never>={
            tilesets:{load:async()=>({tileset:source.tileset})},subtrees:new DenseImplicitSubtreeLoader(),implicitTiles:source.resolver,
            spatial:new EcefSpatialMetric({geodeticSystem:EARTH_SYSTEM}),activation:adapter,presentation:adapter,
        };
        runtime=new TileRuntime({id:"earth",selectionStrategy:"base",uri:"memory://earth/tileset.json",adapter:ports,
            maxScreenSpaceError:sse,quadtreeBalance:{wrapX:true},maxConcurrentLoads:8,cache:{maxContentEntries:256},instrumentation:{enabled:true}});
        if(options.onError) runtime.events.subscribe(event=>{if(event.type==="error") options.onError!(event.error);});
        driver=new BabylonRuntimeDriver(runtime,scene,{camera,manual:true,...(options.onError ? {onError:options.onError}:{})});
        await driver.start();
        return {
            body:EARTH,geodeticSystem:EARTH_SYSTEM,camera,runtime,terrain,
            get atmosphereReady(){return sky?.ready ?? false;},
            update(){
                if(disposed) return Promise.reject(new Error("Earth runtime is disposed."));
                if(updating) return updating;
                updating=(async()=>{
                    camera!.update(); await driver!.updateBeforeRender();
                    if(disposed) return;
                    terrain!.beforeRender(); sky?.update(camera!);
                })().finally(()=>{updating=undefined;});
                return updating;
            },
            async setDate(value){
                if(disposed) throw new Error("Earth runtime is disposed.");
                const next=new Date(value.getTime());const sun=earthSunDirection(next);const revision=++dateRevision;
                const replacement=atmosphereOptions ? await BabylonEarthSky.create(scene,earthAtmosphere(next,atmosphereOptions.physical),atmosphereOptions):undefined;
                if(disposed || revision!==dateRevision){replacement?.dispose();return;}
                sky?.dispose();sky=replacement;date=next;sunlight!.direction=Vector3.FromArray(sun).negate();
            },
            setAtmosphereEnabled(value){if(disposed) throw new Error("Earth runtime is disposed.");sky?.setEnabled(value);},
            setExposure(value){if(disposed) throw new Error("Earth runtime is disposed.");sky?.setExposure(value);},
            dispose,
        };
    } catch(error) {await dispose();throw error;}
}
