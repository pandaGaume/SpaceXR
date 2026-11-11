const fs=require('node:fs'),path=require('node:path');
const root='C:/Users/GuillaumePelletier/Documents/GitHub/Gaume/spacexr-tile-service';
function write(f,t){fs.mkdirSync(path.dirname(path.join(root,f)),{recursive:true});fs.writeFileSync(path.join(root,f),t.trimStart().trimEnd()+'\n');}
const bodyPath=path.join(root,'packages/body-adapter/src/index.ts');fs.writeFileSync(bodyPath,fs.readFileSync(bodyPath,'utf8').replace('.localTangentPlaneDegrees(','.createLocalTangentPlaneDegrees('));
write('packages/tile2d-core/src/index.ts',`import {assertValidTileAddress,tileCount,parentTileAddress,childTileAddresses,type ITileAddress} from "@spacexr/tiles/addressing";
import {parseSchema,ServiceError,Tile2DManifestSchema,type ITile2DManifest,type ITileChannel,type IAvailabilityRange} from "@spacexr-service/shared";
/** Geographic 2x1 address. It is not an unadapted 1x1 XYZ address. */
export interface IGeographicTileAddress {z:number;x:number;y:number;}
/** Angular bounds in degrees, west/south/east/north. */
export type GeographicExtent=readonly[number,number,number,number];
/** Two independent roots share the established local quadtree addressing primitives. */
export function splitAddress(address:IGeographicTileAddress):{root:0|1;local:ITileAddress}{
 const {z,x,y}=address;if(!Number.isInteger(z)||z<0||z>24||!Number.isSafeInteger(x)||x<0)throw new RangeError("Invalid geographic tile address");
 const count=tileCount(z),root=Math.floor(x/count);if(root!==0&&root!==1)throw new RangeError("Geographic column is outside the 2x1 matrix");
 const local={lod:z,x:x-root*count,y};assertValidTileAddress(local);return{root,local};
}
/** Join a validated hemispheric local address into the canonical 2x1 matrix. */
export function joinAddress(root:0|1,local:ITileAddress):IGeographicTileAddress{assertValidTileAddress(local);const result={z:local.lod,x:root*tileCount(local.lod)+local.x,y:local.y};splitAddress(result);return result;}
/** Parent preserves the level-zero hemispheric root. */
export function parentAddress(address:IGeographicTileAddress):IGeographicTileAddress|undefined{const{root,local}=splitAddress(address);const parent=parentTileAddress(local);return parent?joinAddress(root,parent):undefined;}
/** Four children use the common north-west, north-east, south-west, south-east order. */
export function childAddresses(address:IGeographicTileAddress):IGeographicTileAddress[]{const{root,local}=splitAddress(address);if(address.z===24)throw new RangeError("Configured geographic level limit reached");return childTileAddresses(local).map(child=>joinAddress(root,child));}
/** Canonical half-open longitude convention: +180 and -180 identify the same meridian. Latitude never wraps. */
export function normalizeLongitude(longitude:number):number{if(!Number.isFinite(longitude))throw new RangeError("Longitude must be finite");return((longitude+180)%360+360)%360-180;}
/** Locate a geographic point; north and south poles map to the first and last row respectively. */
export function tileAtDegrees(latitude:number,longitude:number,z:number):IGeographicTileAddress{
 if(!Number.isFinite(latitude)||Math.abs(latitude)>90||!Number.isInteger(z)||z<0||z>24)throw new RangeError("Invalid latitude or level");
 const rows=tileCount(z),columns=2*rows;
 const address={z,x:Math.min(columns-1,Math.floor((normalizeLongitude(longitude)+180)/360*columns)),y:Math.min(rows-1,Math.floor((90-latitude)/180*rows))};splitAddress(address);return address;
}
/** Exact angular bounds of one geographic tile, including polar coverage. */
export function tileExtent(address:IGeographicTileAddress):GeographicExtent{splitAddress(address);const size=180/tileCount(address.z);return[-180+address.x*size,90-(address.y+1)*size,-180+(address.x+1)*size,90-address.y*size];}
/** Vertex-grid sample position from a shared global integer lattice, preserving adjacent borders bit-for-bit. */
export function vertexAtDegrees(address:IGeographicTileAddress,column:number,row:number,cells=256):{longitude:number;latitude:number}{
 splitAddress(address);if(!Number.isInteger(cells)||cells<1||!Number.isInteger(column)||!Number.isInteger(row)||column<0||row<0||column>cells||row>cells)throw new RangeError("Invalid vertex coordinate");
 const northSouthCells=tileCount(address.z)*cells;
 return{longitude:-180+(address.x*cells+column)/(2*northSouthCells)*360,latitude:90-(address.y*cells+row)/northSouthCells*180};
}
/** Availability is authoritative; a missing tile does not need an HTTP probe. */
export function hasTile(channel:ITileChannel,address:IGeographicTileAddress):boolean{
 splitAddress(address);return address.z>=channel.minLevel&&address.z<=channel.maxLevel&&channel.availability.some(range=>range.z===address.z&&address.x>=range.minX&&address.x<=range.maxX&&address.y>=range.minY&&address.y<=range.maxY);
}
/** Validate both the shared schema and spatial/numerical invariants. */
export function validateManifest(input:unknown):ITile2DManifest{
 const manifest=parseSchema(Tile2DManifestSchema,input);
 if(!manifest.imagery&&!manifest.elevation)throw new ServiceError(400,"EMPTY_DATASET","A dataset needs imagery or elevation");
 for(const[kind,channel]of [["imagery",manifest.imagery],["dem",manifest.elevation]]as const){
  if(!channel)continue;
  if(channel.minLevel>channel.maxLevel)throw new ServiceError(400,"INVALID_LEVELS","Minimum zoom exceeds maximum zoom");
  if(!channel.url.includes("{z}")||!channel.url.includes("{x}")||!channel.url.includes("{y}")||channel.url.startsWith("/")||channel.url.includes("..")||channel.url.includes(":")||channel.url.includes("\\\\"))throw new ServiceError(400,"INVALID_TEMPLATE","Tile paths must be safe relative z/x/y templates");
  if(kind==="imagery"&&(channel.tileSize===257||!['webp','jpeg'].includes(channel.encoding)))throw new ServiceError(400,"INVALID_IMAGERY","Imagery requires 256/512 pixels and WebP/JPEG encoding");
  if(kind==="dem"&&(channel.tileSize!==257||!['float32-le','terrarium-png'].includes(channel.encoding)||channel.unit!=="m"||!channel.verticalDatum))throw new ServiceError(400,"INVALID_DEM","DEM requires a 257 sample grid, lossless encoding, metres and explicit vertical datum");
  if(kind==="dem"&&channel.encoding==="float32-le"&&channel.noData!=="NaN")throw new ServiceError(400,"INVALID_NODATA","Float32 DEM requires explicit NaN NoData");
  if(kind==="dem"&&channel.encoding==="terrarium-png"&&(channel.noData!=="transparent"||channel.quantizationStepMetres!==1/256))throw new ServiceError(400,"INVALID_QUANTIZATION","Terrarium requires transparent NoData and its 1/256 metre step");
  for(const bounds of channel.footprint)if(bounds[0]>=bounds[2]||bounds[1]>=bounds[3])throw new ServiceError(400,"INVALID_FOOTPRINT","Extent must have west < east and south < north; split antimeridian extents");
  for(const range of channel.availability){if(range.minX>range.maxX||range.minY>range.maxY||range.z<channel.minLevel||range.z>channel.maxLevel)throw new ServiceError(400,"INVALID_AVAILABILITY","Availability range is inconsistent");splitAddress({z:range.z,x:range.minX,y:range.minY});splitAddress({z:range.z,x:range.maxX,y:range.maxY});}
 }
 if(manifest.fallbackDatasetIds.includes(manifest.id))throw new ServiceError(400,"CYCLIC_FALLBACK","A dataset cannot fall back to itself");
 if(!manifest.provenance.verified)throw new ServiceError(400,"UNVERIFIED_DATASET","Only verified generated datasets can be published");
 if(!Number.isFinite(Date.parse(manifest.publishedAt)))throw new ServiceError(400,"INVALID_PUBLICATION_DATE","Publication time is invalid");
 return manifest;
}
/** Source selection includes the ancestor address and UV sub-area; a parent redirect alone is insufficient for overzoom. */
export interface ITileSelection {datasetId:string;revision:string;address:IGeographicTileAddress;relativePath:string;uv:{west:number;north:number;width:number;height:number};}
/** Select published HD/LOW content by explicit fallback graph and availability, without any network probing. */
export function selectTile(datasetId:string,kind:"imagery"|"dem",requested:IGeographicTileAddress,manifests:ReadonlyMap<string,ITile2DManifest>):ITileSelection|undefined{
 splitAddress(requested);const visiting=new Set<string>();
 function select(id:string):ITileSelection|undefined{
  if(visiting.has(id))throw new ServiceError(400,"CYCLIC_FALLBACK","Dataset fallback graph contains a cycle");
  const manifest=manifests.get(id);if(!manifest)return undefined;visiting.add(id);
  const channel=kind==="imagery"?manifest.imagery:manifest.elevation;
  if(channel){let source:IGeographicTileAddress|undefined=requested;while(source){if(hasTile(channel,source)){
   const divisor=2**(requested.z-source.z);visiting.delete(id);
   return{datasetId:id,revision:manifest.revision,address:source,relativePath:channel.url.replaceAll("{z}",String(source.z)).replaceAll("{x}",String(source.x)).replaceAll("{y}",String(source.y)),uv:{west:(requested.x-source.x*divisor)/divisor,north:(requested.y-source.y*divisor)/divisor,width:1/divisor,height:1/divisor}};
  }source=parentAddress(source);}}
  for(const fallback of manifest.fallbackDatasetIds){const result=select(fallback);if(result){visiting.delete(id);return result;}}
  visiting.delete(id);return undefined;
 }
 return select(datasetId);
}
/** Enumerate configured availability in bounded row order without materializing a pyramid. */
export function* addressesInRange(range:IAvailabilityRange):Generator<IGeographicTileAddress>{splitAddress({z:range.z,x:range.minX,y:range.minY});splitAddress({z:range.z,x:range.maxX,y:range.maxY});for(let y=range.minY;y<=range.maxY;y++)for(let x=range.minX;x<=range.maxX;x++)yield{z:range.z,x,y};}
/** Canonical raw Float32 little-endian wire format with quiet NaN NoData, independent of host byte order. */
export function encodeFloat32Dem(samples:Float32Array|Float64Array):Uint8Array{const bytes=new Uint8Array(samples.length*4),view=new DataView(bytes.buffer);for(let i=0;i<samples.length;i++){const sample=samples[i]!;if(Number.isNaN(sample))view.setUint32(i*4,0x7fc00000,true);else{if(!Number.isFinite(sample))throw new RangeError("DEM heights must be finite metres or NaN");view.setFloat32(i*4,sample,true);if(!Number.isFinite(view.getFloat32(i*4,true)))throw new RangeError("Height exceeds Float32 range");}}return bytes;}
/** Decode an exact raw little-endian grid; dimensions and datum come from its manifest. */
export function decodeFloat32Dem(bytes:Uint8Array,sampleCount=257*257):Float32Array{if(bytes.byteLength!==sampleCount*4)throw new RangeError("Unexpected DEM byte length");const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),samples=new Float32Array(sampleCount);for(let i=0;i<sampleCount;i++){samples[i]=view.getFloat32(i*4,true);if(!Number.isFinite(samples[i])&&!Number.isNaN(samples[i]))throw new RangeError("Infinite DEM height is invalid");}return samples;}
`);
write('packages/tile2d-builder/src/index.ts',`import sharp from "sharp";
import {createHeightGrid,encodeTerrariumGrid} from "@spacexr/dem";
import {tileCount} from "@spacexr/tiles/addressing";
import {encodeFloat32Dem,vertexAtDegrees,addressesInRange,validateManifest,type IGeographicTileAddress} from "@spacexr-service/tile2d-core";
import {sha256,type ITile2DManifest,type IBodyReference,type IAvailabilityRange} from "@spacexr-service/shared";
/** One immutable generated object. Consumers can upload it before requesting the next tile. */
export interface IBuiltObject {path:string;bytes:Uint8Array;contentType:string;sha256:string;}
/** Explicit synthetic fixture, never a substitute for a scientific product. */
export interface ISyntheticDatasetOptions {instanceId:string;id:string;revision:string;body:IBodyReference;maxLevel:number;channels?:"both"|"imagery"|"dem";terrarium?:boolean;ranges?:readonly IAvailabilityRange[];fallbackDatasetIds?:string[];priority?:number;maxTiles?:number;}
/** Smooth periodic synthetic elevation in metres, independent of any real planetary data. */
export function syntheticHeight(latitudeDegrees:number,longitudeDegrees:number):number{const lat=latitudeDegrees*Math.PI/180,lon=longitudeDegrees*Math.PI/180;return 500*Math.cos(lat)**2*Math.sin(2*lon)+100*Math.sin(lat);}
/** A canonical 257-square shared-border height grid. */
export function syntheticHeightGrid(address:IGeographicTileAddress):Float32Array{const data=new Float32Array(257*257);for(let row=0;row<=256;row++)for(let column=0;column<=256;column++){const point=vertexAtDegrees(address,column,row);data[row*257+column]=syntheticHeight(point.latitude,point.longitude);}return data;}
/** Build small deterministic fixtures incrementally, with explicit limits and provenance. */
export async function* buildSyntheticDataset(options:ISyntheticDatasetOptions):AsyncGenerator<IBuiltObject>{
 if(!Number.isInteger(options.maxLevel)||options.maxLevel<0||options.maxLevel>12)throw new RangeError("Synthetic level must be an integer from 0 to 12");
 const ranges=options.ranges?[...options.ranges]:Array.from({length:options.maxLevel+1},(_,z)=>({z,minX:0,maxX:2*tileCount(z)-1,minY:0,maxY:tileCount(z)-1}));
 let tiles=0;for(const range of ranges)tiles+=(range.maxX-range.minX+1)*(range.maxY-range.minY+1);if(tiles>(options.maxTiles??1000))throw new RangeError("Synthetic dataset exceeds the requested tile budget");
 const hashes:Record<string,string>={};
 async function object(path:string,bytes:Uint8Array,contentType:string):Promise<IBuiltObject>{const hash=await sha256(bytes);hashes[path]=hash;return{path,bytes,contentType,sha256:hash};}
 const channels=options.channels??"both";
 for(const range of ranges)for(const address of addressesInRange(range)){
  if(channels!=="dem"){
   const rgb=new Uint8Array(256*256*3);
   for(let row=0;row<256;row++)for(let col=0;col<256;col++){const p=vertexAtDegrees(address,col,row);const i=(row*256+col)*3;rgb[i]=Math.round((p.longitude+180)/360*255);rgb[i+1]=Math.round((p.latitude+90)/180*255);rgb[i+2]=100;}
   const encoded=new Uint8Array(await sharp(rgb,{raw:{width:256,height:256,channels:3}}).webp({quality:80}).toBuffer());
   yield await object("imagery/"+address.z+"/"+address.x+"/"+address.y+".webp",encoded,"image/webp");
  }
  if(channels!=="imagery"){
   const data=syntheticHeightGrid(address);
   if(options.terrarium){const pixels=encodeTerrariumGrid(createHeightGrid(257,257,data));const png=new Uint8Array(await sharp(pixels.data,{raw:{width:257,height:257,channels:4}}).png().toBuffer());yield await object("dem/"+address.z+"/"+address.x+"/"+address.y+".png",png,"image/png");}
   else yield await object("dem/"+address.z+"/"+address.x+"/"+address.y+".f32",encodeFloat32Dem(data),"application/octet-stream");
  }
 }
 const minLevel=Math.min(...ranges.map(r=>r.z)),maxLevel=Math.max(...ranges.map(r=>r.z));
 const base={minLevel,maxLevel,availability:ranges,footprint:[[-180,-90,180,90] as [number,number,number,number]],resolutionMetres:2*Math.PI*options.body.semiMajorAxisMetres/(2*tileCount(maxLevel)*256)};
 const manifest:ITile2DManifest={schema:"spacexr.tile2d/1",id:options.id,revision:options.revision,instanceId:options.instanceId,bodyId:options.body.id,tileMatrixSet:{id:"spacexr-geographic-2x1",projection:"equirectangular",origin:"north-west",levelZeroColumns:2,levelZeroRows:1},referenceFrame:options.body.profile.referenceFrame,latitudeType:"planetographic",longitudeDirection:"east-positive",fallbackDatasetIds:options.fallbackDatasetIds??[],priority:options.priority??0,provenance:{kind:"synthetic",source:"Analytical periodic fixture",attribution:"Synthetic test data",license:"CC0-1.0",verified:true},contentHashes:hashes,publishedAt:new Date(0).toISOString()};
 if(channels!=="dem")manifest.imagery={...base,url:"imagery/{z}/{x}/{y}.webp",tileSize:256,encoding:"webp"};
 if(channels!=="imagery")manifest.elevation={...base,url:options.terrarium?"dem/{z}/{x}/{y}.png":"dem/{z}/{x}/{y}.f32",tileSize:257,encoding:options.terrarium?"terrarium-png":"float32-le",unit:"m",noData:options.terrarium?"transparent":"NaN",verticalDatum:options.body.profile.verticalDatum,...options.terrarium?{quantizationStepMetres:1/256}:{}};
 validateManifest(manifest);const bytes=new TextEncoder().encode(JSON.stringify(manifest));yield{path:"manifest.json",bytes,contentType:"application/json",sha256:await sha256(bytes)};
}
`);
write('tests/tile2d.test.ts',`import {describe,it,expect} from "vitest";
import {BodyRegistry} from "@spacexr-service/body-adapter";
import {buildSyntheticDataset,syntheticHeightGrid} from "@spacexr-service/tile2d-builder";
import {tileAtDegrees,tileExtent,childAddresses,parentAddress,normalizeLongitude,selectTile,validateManifest,encodeFloat32Dem,decodeFloat32Dem} from "@spacexr-service/tile2d-core";
import type {IBodyProfile,ITile2DManifest} from "@spacexr-service/shared";
const profile:IBodyProfile={id:"moon",catalogueName:"Moon",referenceFrame:"body-fixed:moon",latitudeType:"planetographic",longitudeDirection:"east-positive",verticalDatum:"reference-ellipsoid"};
describe("geographic 2x1 matrix",()=>{
 it("covers both hemispheric roots and the full poles",()=>{expect(tileExtent({z:0,x:0,y:0})).toEqual([-180,-90,0,90]);expect(tileExtent({z:0,x:1,y:0})).toEqual([0,-90,180,90]);expect(tileAtDegrees(-90,179,2)).toEqual({z:2,x:7,y:3});expect(tileAtDegrees(90,-180,2)).toEqual({z:2,x:0,y:0});expect(normalizeLongitude(540)).toBe(-180);expect(()=>tileAtDegrees(91,0,1)).toThrow();});
 it("reuses local quadtree parent/child semantics across both roots",()=>{for(const x of [0,1])for(const child of childAddresses({z:0,x,y:0}))expect(parentAddress(child)).toEqual({z:0,x,y:0});});
 it("shares borders and periodic seams without resampling",()=>{const a=syntheticHeightGrid({z:1,x:1,y:0}),b=syntheticHeightGrid({z:1,x:2,y:0}),c=syntheticHeightGrid({z:1,x:1,y:1});for(let i=0;i<257;i++){expect(a[i*257+256]).toBe(b[i*257]);expect(a[256*257+i]).toBe(c[i]);}});
 it("serializes Float32 in declared little-endian order with canonical NoData",()=>{const bytes=encodeFloat32Dem(new Float32Array([1,NaN,-2]));expect([...bytes.slice(0,4)]).toEqual([0,0,128,63]);expect([...bytes.slice(4,8)]).toEqual([0,0,192,127]);const values=decodeFloat32Dem(bytes,3);expect(values[0]).toBe(1);expect(values[1]).toBeNaN();expect(values[2]).toBe(-2);expect(()=>decodeFloat32Dem(bytes,2)).toThrow();});
});
describe("synthetic publication contracts",()=>{
 it("generates real WebP and 257-square DEM objects with an authoritative manifest",async()=>{const body=new BodyRegistry([profile]).get("moon"),objects=[];for await(const object of buildSyntheticDataset({instanceId:"test",id:"low",revision:"v1",body,maxLevel:0}))objects.push(object);expect(objects).toHaveLength(5);const dem=objects.find(o=>o.path==="dem/0/0/0.f32")!;expect(decodeFloat32Dem(dem.bytes)).toHaveLength(257*257);const manifest=validateManifest(JSON.parse(new TextDecoder().decode(objects.at(-1)!.bytes)));expect(manifest.provenance.kind).toBe("synthetic");expect(manifest.tileMatrixSet.levelZeroColumns).toBe(2);});
 it("selects independent channel fallback and returns correct overzoom UVs without HTTP calls",async()=>{const body=new BodyRegistry([profile]).get("moon");let low:ITile2DManifest|undefined;for await(const object of buildSyntheticDataset({instanceId:"test",id:"low",revision:"v1",body,maxLevel:0}))if(object.path==="manifest.json")low=validateManifest(JSON.parse(new TextDecoder().decode(object.bytes)));const hd:ITile2DManifest={...low!,id:"hd",fallbackDatasetIds:["low"],imagery:undefined,elevation:undefined};const manifests=new Map([["low",low!],["hd",hd]]);const selected=selectTile("hd","imagery",{z:2,x:5,y:3},manifests);expect(selected?.datasetId).toBe("low");expect(selected?.address).toEqual({z:0,x:1,y:0});expect(selected?.uv).toEqual({west:0.25,north:0.75,width:0.25,height:0.25});expect(()=>validateManifest(hd)).toThrow();});
});
`);
console.log('Geographic tile contracts and incremental synthetic builders prepared.');
