import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Worker } from "node:worker_threads";
import sharp from "sharp";
import { createHeightGrid, encodeTerrariumGrid } from "@spacexr/dem";
import { cubeTileDirection, ReferenceSurface } from "@spacexr/tiles/cube";
import { borderHashes, globalTilePixels, sampleLolaMetres, verifyGlobalBorders, type IGlobalFile, type ILolaPixels, type ILunarColourPixels } from "../tools/lunar/global-kernel";
import { globalSourcePpd, parsePdsLunarLabel } from "../tools/lunar/global-sources";
import { globalTileCount, type IGlobalWorkerData } from "../tools/lunar/global";

const roots: string[] = [];
afterEach(async () => { for (const root of roots.splice(0)) await rm(root,{recursive:true,force:true}); });

const raster: ILolaPixels = { width:8,height:4,values:Int16Array.from({length:32},(_,i)=>i*13-160),north:-57.25,south:98.75 };
const atlas: ILunarColourPixels = { width:8,height:4,values:Uint8Array.from({length:96},(_,i)=>(i*19)%256) };
const rasters = new Map([4,16,64,128].map(ppd=>[ppd,raster]));
const colours = new Map([1024,2048,4096,8192,16384].map(width=>[width,atlas]));

describe("global lunar physical interpretation", () => {
    const label=`PRODUCT_ID = "LDEM_128"
LINES = 23040
LINE_SAMPLES = 46080
SAMPLE_TYPE = LSB_INTEGER
SAMPLE_BITS = 16
UNIT = METER
SCALING_FACTOR = 0.5
OFFSET = 1737400.
MAP_RESOLUTION = 128 <pix/deg>
POSITIVE_LONGITUDE_DIRECTION = "EAST"
WESTERNMOST_LONGITUDE = 0
EASTERNMOST_LONGITUDE = 360
MAXIMUM_LATITUDE = 90
MINIMUM_LATITUDE = -90
RECORD_BYTES = 92160
FILE_RECORDS = 23040
COORDINATE_SYSTEM_NAME = "MEAN EARTH/POLAR AXIS OF DE421"
MAP_PROJECTION_TYPE = "SIMPLE CYLINDRICAL"`;
    it("reads half-metre PDS heights without adding the reference radius twice", () => {
        expect(parsePdsLunarLabel(label,128)).toMatchObject({width:46080,height:23040,scale:0.5,sourceRadius:1737400});
        expect(()=>parsePdsLunarLabel(label.replace("LSB_INTEGER","MSB_INTEGER"),128)).toThrow();
        expect(()=>parsePdsLunarLabel(label.replace("SCALING_FACTOR = 0.5","SCALING_FACTOR = 1"),128)).toThrow();
        expect(()=>parsePdsLunarLabel(label.replace('"EAST"','"WEST"'),128)).toThrow();
        expect(()=>parsePdsLunarLabel(label.replace("OFFSET = 1737400.","OFFSET = 1738100."),128)).toThrow();
    });
    it("chooses a source from the level alone and includes all parent tiles", () => {
        expect(Array.from({length:7},(_,lod)=>globalSourcePpd(lod))).toEqual([4,16,16,64,64,128,128]);
        expect(globalTileCount(6)).toBe(32766);expect(globalTileCount(0)).toBe(6);
        expect(()=>globalTileCount(7)).toThrow();
    });
    it("wraps native 0..360 longitude and collapses each pole to one height", () => {
        expect(sampleLolaMetres(raster,0,67.5)).toBe((raster.values[7]!+raster.values[0]!)/4);
        expect(sampleLolaMetres(raster,-180,10)).toBe(sampleLolaMetres(raster,180,10));
        expect(sampleLolaMetres(raster,25,90)).toBe(sampleLolaMetres(raster,-140,90));
        expect(sampleLolaMetres(raster,25,-90)).toBe(raster.south);
    });
    it("agrees with the library's cube directions and preserves radius on an ellipsoid", () => {
        const radii: [number,number,number]=[1738100,1738100,1736000],target=new ReferenceSurface(...radii);
        for(let face=0;face<6;face++){
            const address={face,lod:2,x:1,y:2},result=globalTilePixels(address,rasters,colours,radii,8);
            for(let y=0;y<=8;y++)for(let x=0;x<=8;x++){
                const d=cubeTileDirection(address,x/8,y/8),lon=Math.atan2(d.y,d.x)*180/Math.PI,lat=Math.atan2(d.z,Math.hypot(d.x,d.y))*180/Math.PI;
                expect(result.heights[y*9+x]!+target.radius(d)).toBeCloseTo(1737400+sampleLolaMetres(raster,lon,lat),3);
            }
        }
    });
});

describe("complete cube border continuity", () => {
    it("matches all internal, turned and reversed borders in both channels", () => {
        const files: IGlobalFile[]=[];
        for(let lod=0;lod<=1;lod++)for(let face=0;face<6;face++)for(let y=0;y<2**lod;y++)for(let x=0;x<2**lod;x++){
            const address={face,lod,x,y},pixels=globalTilePixels(address,rasters,colours,[1738100,1738000,1736000],4);
            const rgba=encodeTerrariumGrid(createHeightGrid(5,5,pixels.heights));
            for(const kind of ["elevation","imagery"] as const)files.push({kind,address,path:`${kind}/${face}/${lod}/${x}/${y}`,bytes:0,sha256:"fixture",borders:borderHashes(kind==="elevation"?rgba.data:pixels.rgb,kind==="elevation"?4:3,5)});
        }
        expect(verifyGlobalBorders(files)).toBe(120);
        const missing=files.slice(1);expect(()=>verifyGlobalBorders(missing)).toThrow("Missing neighbor");
        files[0]!.borders[0]="broken";expect(()=>verifyGlobalBorders(files)).toThrow("mismatch");
    });
    it("bootstraps a real worker and preserves border bytes through PNG and WebP",async()=>{
        const root=await mkdtemp(join(tmpdir(),"moon-global-"));roots.push(root);
        const demBuffer=new SharedArrayBuffer(raster.values.byteLength);new Int16Array(demBuffer).set(raster.values);
        const colourBuffer=new SharedArrayBuffer(1024*512*3);new Uint8Array(colourBuffer).fill(115);
        const input:IGlobalWorkerData={root,prefix:"dataset",revision:"fixture",radii:[1738100,1738100,1736000],dems:[{ppd:4,width:8,height:4,north:raster.north,south:raster.south,buffer:demBuffer}],colours:[{width:1024,height:512,buffer:colourBuffer}]};
        const worker=new Worker(new URL("../tools/lunar/global-worker.mjs",import.meta.url),{workerData:input,execArgv:[]});
        try{
            const files=await new Promise<IGlobalFile[]>((accept,reject)=>{
                worker.on("error",reject);worker.on("message",message=>{
                    if(message.type==="ready")worker.postMessage({face:5,lod:0,y:0});
                    else if(message.type==="failure")reject(new Error(message.message));
                    else if(message.type==="row")accept(message.files);
                });
            });
            expect(files).toHaveLength(2);
            for(const file of files){
                const bytes=await readFile(join(root,"dataset",file.path)),image=sharp(bytes);
                expect((await image.metadata()).width).toBe(257);
                const pixels=file.kind==="elevation"?await image.ensureAlpha().raw().toBuffer():await image.removeAlpha().raw().toBuffer();
                expect(borderHashes(pixels,file.kind==="elevation"?4:3)).toEqual(file.borders);
            }
        }finally{await worker.terminate();}
    });
});
