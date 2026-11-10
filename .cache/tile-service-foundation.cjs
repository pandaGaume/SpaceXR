const fs=require('node:fs'),path=require('node:path');
const root='C:/Users/GuillaumePelletier/Documents/GitHub/Gaume/spacexr-tile-service';
function write(f,t){if(t.includes(String.fromCharCode(0x2014)))throw new Error('Forbidden punctuation');fs.mkdirSync(path.dirname(path.join(root,f)),{recursive:true});fs.writeFileSync(path.join(root,f),t.trimStart().trimEnd()+'\n');}
const modules=['shared','body-adapter','tile2d-core','tile2d-builder','tiles3d-builder','layer-service','storage'];
for(const name of modules)write('packages/'+name+'/package.json',JSON.stringify({name:'@spacexr-service/'+name,version:'0.1.0',private:true,type:'module',exports:{'.':'./src/index.ts'}},null,2));
for(const name of ['api','admin'])write('apps/'+name+'/package.json',JSON.stringify({name:'@spacexr-service/'+name,version:'0.1.0',private:true,type:'module'},null,2));
const deps={
 '@spacexr/celestial-core':'file:../celestial-core',quantia:'file:../quantia','@spacexr/geodesy':'0.4.0',
 '@sinclair/typebox':'0.34.52',aws4fetch:'1.0.20',yaml:'^2.8.0',sharp:'0.35.5',
 '@gltf-transform/core':'4.5.1','@gltf-transform/functions':'4.5.1','gl-matrix':'3.4.4',
};
for(const [dir,name] of [['core','3d-tiles-core'],['runtime','3d-tiles-runtime'],['tiles','tiles'],['raster','raster'],['dem','dem']])deps['@spacexr/'+name]='file:../3d-tiles-core/node/packages/'+dir;
write('package.json',JSON.stringify({name:'spacexr-tile-service',version:'0.1.0',private:true,type:'module',engines:{node:'>=22.0.0'},workspaces:['apps/*','packages/*'],
 scripts:{generate:'tsx tools/generate-schemas.ts',configure:'tsx tools/service-cli/src/main.ts configure',dev:'tsx tools/service-cli/src/main.ts dev',build:'node scripts/build.mjs',typecheck:'tsc --noEmit',test:'npm run build && vitest run',lint:'eslint "{apps,packages,tools,workers,tests}/**/*.ts"',format:'prettier --check "{apps,packages,tools,workers,tests,deployments,docs,migrations,scripts}/**/*.{ts,js,mjs,json,yaml,md,html,css,sql}" "*.{json,md,ts}" --ignore-unknown','format:fix':'prettier --write "{apps,packages,tools,workers,tests,deployments,docs,migrations,scripts}/**/*.{ts,js,mjs,json,yaml,md,html,css,sql}" "*.{json,md,ts}" --ignore-unknown',check:'npm run format && npm run lint && npm run typecheck && npm test',synthetic:'tsx tools/synthetic.ts',worker:'tsx workers/build-consumer/src/main.ts',cli:'tsx tools/service-cli/src/main.ts'},
 dependencies:deps,devDependencies:{'@cloudflare/workers-types':'5.20261104.1','@types/node':'^22.0.0','@typescript-eslint/eslint-plugin':'^7.0.0','@typescript-eslint/parser':'^7.0.0',eslint:'^8.57.0','eslint-config-prettier':'^9.1.0',prettier:'^3.2.0',typescript:'^5.4.0',tsx:'4.23.15',esbuild:'0.28.2',vitest:'4.1.11',miniflare:'4.20260730.0',wrangler:'4.157.0','json-schema-to-typescript':'16.0.0',ajv:'8.20.0',typedoc:'^0.28.0'},
 overrides:{vite:'8.3.1',quantia:'$quantia','@spacexr/geodesy':'$@spacexr/geodesy','@spacexr/3d-tiles-core':'$@spacexr/3d-tiles-core','@spacexr/tiles':'$@spacexr/tiles','@spacexr/raster':'$@spacexr/raster'}},null,2));
write('.gitignore','node_modules/\ndist/\n.generated/\n.local/\n.cache/\n.wrangler/\n.dev.vars*\n.env*\n*.tgz\ncoverage/\ndocs/api/');
write('.gitattributes','* text=auto eol=lf');
write('.prettierrc.json',JSON.stringify({printWidth:120,tabWidth:4,trailingComma:'all'},null,2));
write('.eslintrc.cjs',`module.exports={root:true,env:{es2022:true,node:true,browser:true},parser:"@typescript-eslint/parser",parserOptions:{ecmaVersion:"latest",sourceType:"module",project:"./tsconfig.json"},plugins:["@typescript-eslint"],extends:["eslint:recommended","plugin:@typescript-eslint/recommended","prettier"],ignorePatterns:["node_modules","dist",".generated","packages/shared/generated"],rules:{"@typescript-eslint/consistent-type-imports":"error","@typescript-eslint/no-unused-vars":["error",{argsIgnorePattern:"^_"}]}};`);
write('tsconfig.json',JSON.stringify({compilerOptions:{target:'ES2022',module:'ESNext',moduleResolution:'Bundler',lib:['ES2022','DOM'],types:['node'],strict:true,skipLibCheck:true,noUnusedLocals:true,noUnusedParameters:true,noImplicitReturns:true,noImplicitOverride:true,esModuleInterop:true,resolveJsonModule:true},include:['apps/**/*.ts','packages/**/*.ts','tools/**/*.ts','workers/**/*.ts','tests/**/*.ts','*.config.ts'],exclude:['node_modules','dist','.generated','**/generated/**']},null,2));
write('vitest.config.ts',`import {defineConfig} from "vitest/config";
export default defineConfig({test:{include:["tests/**/*.test.ts"],testTimeout:30000,hookTimeout:60000,fileParallelism:false}});`);

write('packages/shared/src/schemas.ts',`import {Type, type Static} from "@sinclair/typebox";
/** Stable URL-safe identifier; object-storage paths are never supplied directly by a browser. */
export const IdSchema=Type.String({pattern:"^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$"});
const Text=Type.String({minLength:1,maxLength:200});
/** Canonical geographic extent in degrees. A wrapping footprint is represented by separate extents. */
export const ExtentSchema=Type.Tuple([Type.Number({minimum:-180,maximum:180}),Type.Number({minimum:-90,maximum:90}),Type.Number({minimum:-180,maximum:180}),Type.Number({minimum:-90,maximum:90})]);
const Level=Type.Integer({minimum:0,maximum:24});
/** Explicit sparse rectangular availability ranges, partitionable into immutable level shards. */
export const AvailabilityRangeSchema=Type.Object({z:Level,minX:Type.Integer({minimum:0}),maxX:Type.Integer({minimum:0}),minY:Type.Integer({minimum:0}),maxY:Type.Integer({minimum:0})},{additionalProperties:false});
/** Per-channel publication contract; a missing channel is absent, not inferred from another channel. */
export const TileChannelSchema=Type.Object({
 url:Text,minLevel:Level,maxLevel:Level,tileSize:Type.Union([Type.Literal(256),Type.Literal(512),Type.Literal(257)]),
 encoding:Type.Union([Type.Literal("webp"),Type.Literal("jpeg"),Type.Literal("float32-le"),Type.Literal("terrarium-png")]),
 unit:Type.Optional(Type.Literal("m")),noData:Type.Optional(Type.Union([Type.Literal("NaN"),Type.Literal("transparent")])),
 availability:Type.Array(AvailabilityRangeSchema,{maxItems:10000}),footprint:Type.Array(ExtentSchema,{minItems:1,maxItems:1000}),
 verticalDatum:Type.Optional(Text),quantizationStepMetres:Type.Optional(Type.Number({exclusiveMinimum:0})),resolutionMetres:Type.Number({exclusiveMinimum:0}),
},{additionalProperties:false});
/** Shared, versioned imagery/DEM manifest. Published revision paths are immutable. */
export const Tile2DManifestSchema=Type.Object({
 schema:Type.Literal("spacexr.tile2d/1"),id:IdSchema,bodyId:IdSchema,revision:IdSchema,instanceId:IdSchema,
 tileMatrixSet:Type.Object({id:Type.Literal("spacexr-geographic-2x1"),projection:Type.Literal("equirectangular"),origin:Type.Literal("north-west"),levelZeroColumns:Type.Literal(2),levelZeroRows:Type.Literal(1)},{additionalProperties:false}),
 referenceFrame:Text,latitudeType:Type.Literal("planetographic"),longitudeDirection:Type.Literal("east-positive"),
 imagery:Type.Optional(TileChannelSchema),elevation:Type.Optional(TileChannelSchema),
 fallbackDatasetIds:Type.Array(IdSchema,{maxItems:16}),priority:Type.Integer({minimum:0,maximum:10000}),
 provenance:Type.Object({kind:Type.Union([Type.Literal("synthetic"),Type.Literal("scientific"),Type.Literal("user")]),source:Text,attribution:Text,license:Text,verified:Type.Boolean()},{additionalProperties:false}),
 contentHashes:Type.Record(Type.String(),Type.String({pattern:"^[a-f0-9]{64}$"})),
 publishedAt:Type.String({minLength:10,maxLength:40}),
},{additionalProperties:false,$id:"ITile2DManifest"});
/** Physical shape comes from the celestial registry; this profile adds explicit reference conventions. */
export const BodyProfileSchema=Type.Object({id:IdSchema,catalogueName:Text,referenceFrame:Text,latitudeType:Type.Literal("planetographic"),longitudeDirection:Type.Literal("east-positive"),verticalDatum:Type.Literal("reference-ellipsoid")},{additionalProperties:false});
/** A local engineering frame has no implicit Earth origin or astronomical orientation. */
export const EngineeringFrameSchema=Type.Object({id:IdSchema,name:Text,units:Type.Literal("m"),axes:Type.Literal("right-handed-z-up")},{additionalProperties:false});
/** Independent deployment configuration; secrets and cloud resource identifiers are separate. */
export const ServiceConfigSchema=Type.Object({
 service:Type.Object({id:IdSchema,name:Text,purpose:Type.String({minLength:1,maxLength:80}),baseUrl:Text,adminOrigin:Text,ownerTenant:IdSchema},{additionalProperties:false}),
 features:Type.Object({tile2d:Type.Boolean(),tiles3d:Type.Boolean(),assetUpload:Type.Boolean(),layerPublishing:Type.Boolean()},{additionalProperties:false}),
 catalog:Type.Object({bodies:Type.Array(BodyProfileSchema,{maxItems:100}),engineeringFrames:Type.Array(EngineeringFrameSchema,{maxItems:100})},{additionalProperties:false}),
 quotas:Type.Object({assetBytes:Type.Integer({minimum:1024,maximum:67108864}),tenantStorageBytes:Type.Integer({minimum:1024}),layerObjects:Type.Integer({minimum:1,maximum:1000000}),activeJobs:Type.Integer({minimum:1,maximum:64}),requestsPerMinute:Type.Integer({minimum:1,maximum:100000}),builderObjects:Type.Integer({minimum:1,maximum:1000000})},{additionalProperties:false}),
 extensions:Type.Array(Type.String({pattern:"^[a-zA-Z0-9][a-zA-Z0-9_/-]{0,100}$"}),{maxItems:20}),
},{additionalProperties:false,$id:"IServiceConfig"});
/** Draft layer in either a body-fixed or a local engineering reference system. */
export const LayerInputSchema=Type.Object({name:Text,visibility:Type.Union([Type.Literal("public"),Type.Literal("private")]),bodyId:Type.Optional(IdSchema),frameId:Type.Optional(IdSchema),metadata:Type.Optional(Type.Record(Type.String(),Type.Unknown()))},{additionalProperties:false,$id:"ILayerInput"});
/** Asset upload declaration; the original is quarantined until an external validator accepts it. */
export const UploadInputSchema=Type.Object({name:Text,byteLength:Type.Integer({minimum:20,maximum:67108864}),sha256:Type.String({pattern:"^[a-f0-9]{64}$"}),contentType:Type.Union([Type.Literal("model/gltf-binary"),Type.Literal("model/gltf+json")])},{additionalProperties:false,$id:"IUploadInput"});
const Geographic=Type.Object({longitude:Type.Number({minimum:-180,maximum:180}),latitude:Type.Number({minimum:-90,maximum:90}),altitude:Type.Number({minimum:-1000000,maximum:1e9}),altitudeMode:Type.Union([Type.Literal("absolute"),Type.Literal("relative-to-ground")])},{additionalProperties:false});
const Cartesian=Type.Object({x:Type.Number({minimum:-1e9,maximum:1e9}),y:Type.Number({minimum:-1e9,maximum:1e9}),z:Type.Number({minimum:-1e9,maximum:1e9})},{additionalProperties:false});
/** glTF -Z is forward, +Y is up. Heading is clockwise from north; pitch is nose-up and roll is right-down, in degrees. */
export const PlacedAssetInputSchema=Type.Object({assetId:IdSchema,position:Type.Union([Geographic,Cartesian]),orientation:Type.Object({heading:Type.Number(),pitch:Type.Number(),roll:Type.Number()},{additionalProperties:false}),scale:Type.Tuple([Type.Number({exclusiveMinimum:0,maximum:1e6}),Type.Number({exclusiveMinimum:0,maximum:1e6}),Type.Number({exclusiveMinimum:0,maximum:1e6})]),metadata:Type.Optional(Type.Record(Type.String(),Type.Unknown()))},{additionalProperties:false,$id:"IPlacedAssetInput"});
/** Conditional object edit; version is required to avoid lost updates. */
export const ObjectUpdateSchema=Type.Object({version:Type.Integer({minimum:1}),...PlacedAssetInputSchema.properties},{additionalProperties:false,$id:"IObjectUpdate"});
/** Conditional layer edit. Reference-system changes require a new layer. */
export const LayerUpdateSchema=Type.Object({version:Type.Integer({minimum:1}),name:Type.Optional(Text),visibility:Type.Optional(Type.Union([Type.Literal("public"),Type.Literal("private")]))},{additionalProperties:false,$id:"ILayerUpdate"});
/** Dataset registration refers to a separately validated immutable manifest. */
export const DatasetInputSchema=Type.Object({manifest:Tile2DManifestSchema},{additionalProperties:false,$id:"IDatasetInput"});
/** A publish request identifies the draft version being snapshotted. */
export const PublishInputSchema=Type.Object({version:Type.Integer({minimum:1})},{additionalProperties:false,$id:"IPublishInput"});
/** Authoritative deployment type inferred from the same runtime schema. */
export type IServiceConfig=Static<typeof ServiceConfigSchema>;
/** Authoritative versioned dataset type. */
export type ITile2DManifest=Static<typeof Tile2DManifestSchema>;
/** Independent body reference-profile metadata. */
export type IBodyProfile=Static<typeof BodyProfileSchema>;
/** Layer creation values. */ export type ILayerInput=Static<typeof LayerInputSchema>;
/** Placement values before a server assigns identity and version. */ export type IPlacedAssetInput=Static<typeof PlacedAssetInputSchema>;
/** Canonical channel availability values. */ export type IAvailabilityRange=Static<typeof AvailabilityRangeSchema>;
/** Published raster channel. */ export type ITileChannel=Static<typeof TileChannelSchema>;
/** Schemas emitted as JSON and generated declaration files for non-TypeBox consumers. */
export const publicSchemas={IServiceConfig:ServiceConfigSchema,ITile2DManifest:Tile2DManifestSchema,ILayerInput:LayerInputSchema,IUploadInput:UploadInputSchema,IPlacedAssetInput:PlacedAssetInputSchema,IObjectUpdate:ObjectUpdateSchema,ILayerUpdate:LayerUpdateSchema,IDatasetInput:DatasetInputSchema,IPublishInput:PublishInputSchema};
`);
write('packages/shared/src/errors.ts',`import {Value} from "@sinclair/typebox/value";
import type {Static,TSchema} from "@sinclair/typebox";
/** Structured API error. Internal stack traces and credentials never enter HTTP responses. */
export class ServiceError extends Error {
 /** Store the HTTP status, stable machine code and safe public message. */
 public constructor(public readonly status:number,public readonly code:string,message:string,public readonly details?:unknown){super(message);}
}
/** Interpret a JSON schema without runtime code generation, compatible with Workers' no-eval environment. */
export function parseSchema<T extends TSchema>(schema:T,value:unknown):Static<T>{
 if(!Value.Check(schema,value))throw new ServiceError(400,"INVALID_INPUT","Request does not match its schema",[...Value.Errors(schema,value)].slice(0,12).map(error=>({path:error.path,message:error.message})));
 return value as Static<T>;
}
/** Require an unambiguous safe object-path segment. */
export function safeId(value:string):string{if(!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(value))throw new ServiceError(400,"INVALID_ID","Invalid resource identifier");return value;}
/** Decode and validate a relative resource path, rejecting traversal and encoded separators. */
export function safePath(value:string):string{let decoded:string;try{decoded=decodeURIComponent(value);}catch{throw new ServiceError(400,"INVALID_PATH","Malformed resource path");}if(!decoded||decoded.split("/").some(part=>!part||part==="."||part===".."||!/^[a-zA-Z0-9_.-]+$/.test(part)))throw new ServiceError(400,"INVALID_PATH","Unsafe resource path");return decoded;}
/** Compute a lowercase SHA-256 hex digest using the standard Web Crypto API. */
export async function sha256(bytes:Uint8Array|string):Promise<string>{const input=typeof bytes==="string"?new TextEncoder().encode(bytes):bytes;const digest=await crypto.subtle.digest("SHA-256",input.slice().buffer);return[...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,"0")).join("");}
/** JSON response with explicit content type and no implicit public caching. */
export function json(value:unknown,status=200,headers:HeadersInit={}):Response{return new Response(JSON.stringify(value),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store",...headers}});}
`);
write('packages/shared/src/contracts.ts',`import type {D1Database,R2Bucket,Queue} from "@cloudflare/workers-types";
import type {IServiceConfig,IBodyProfile,IPlacedAssetInput} from "./schemas";
/** Per-instance bindings. S3 signing credentials exist only in Worker secrets. */
export interface IBindings {
 /** Deployment metadata database. */ DB:D1Database;
 /** Immutable public objects served by a custom CDN domain. */ PUBLIC:R2Bucket;
 /** Private originals, staging and private revision objects. */ PRIVATE:R2Bucket;
 /** Asynchronous job identifiers; persisted outbox covers producer failures. */ JOBS?:Queue<{jobId:string;instanceId:string}>;
 /** Scoped bootstrap owner token, never stored in source. */ OWNER_TOKEN:string;
 /** Separate credential for internal build operations. */ BUILD_TOKEN:string;
 /** S3-compatible account endpoint; absent only in local development. */ R2_ENDPOINT?:string;
 /** Per-instance public bucket name. */ R2_PUBLIC_BUCKET?:string;
 /** Per-instance private bucket name. */ R2_PRIVATE_BUCKET?:string;
 /** Restricted S3 key used only to sign uploads. */ R2_ACCESS_KEY_ID?:string;
 /** Restricted S3 secret used only to sign uploads. */ R2_SECRET_ACCESS_KEY?:string;
 /** Public custom-domain origin for immutable objects. */ STATIC_BASE_URL?:string;
 /** Explicit local-only upload mode; production configuration refuses it. */ LOCAL_DEV?:string;
}
/** Minimal background-execution port accepted by the Worker and tests. */
export interface IExecutionContext {waitUntil(promise:Promise<unknown>):void;}
/** Authorized principal, isolated from resource identifiers. */
export interface IPrincipal {tenantId:string;subject:string;scopes:readonly string[];kind:"owner"|"token"|"builder";}
/** Renderer-neutral body reference descriptor. Physical shape stays in the celestial registry. */
export interface IBodyReference {id:string;name:string;profile:IBodyProfile;semiMajorAxisMetres:number;semiMinorAxisMetres:number;}
/** Body integration port, optional for engineering-only deployments. */
export interface IBodyRegistry {list():readonly IBodyReference[];get(id:string):IBodyReference;}
/** Immutable per-request service context. */
export interface IServiceContext {config:IServiceConfig;env:IBindings;execution:IExecutionContext;bodies?:IBodyRegistry;request:Request;url:URL;principal?:IPrincipal;}
/** Server-managed placement identity and optimistic version. */
export interface IPlacedAsset extends IPlacedAssetInput {id:string;layerId:string;version:number;}
/** Draft layer record and revision pointer. */
export interface ILayer {id:string;tenantId:string;name:string;bodyId?:string;frameId?:string;visibility:"public"|"private";status:"draft"|"published";version:number;activeRevision?:string;metadata:Record<string,unknown>;}
/** Persistent external-processing job. */
export interface IJob {id:string;tenantId:string;kind:"asset-validate"|"layer-publish"|"dataset-ingest";status:"queued"|"running"|"succeeded"|"failed";resourceId:string;payload:Record<string,unknown>;leaseToken?:string;leaseUntil?:number;error?:string;}
/** Business extension operates through explicit policies, not tile-math branches. */
export interface IServiceExtension {id:string;validateLayer?(input:unknown):void;validatePlacement?(input:unknown):void;authorize?(principal:IPrincipal,operation:string,resource:unknown):boolean;}
/** One optional capability contributes routes to the common HTTP application. */
export interface ICapability {id:string;handle(context:IServiceContext,segments:readonly string[]):Promise<Response|undefined>;}
`);
write('packages/shared/src/index.ts','export * from "./schemas";\nexport * from "./errors";\nexport * from "./contracts";');

write('packages/body-adapter/src/index.ts',`import {SolarSystemBodies,type CelestialCatalogue} from "@spacexr/celestial-core/catalog";
import {GeodeticSystem,LocalTangentPlane} from "@spacexr/geodesy";
import {Length} from "quantia";
import {ServiceError,type IBodyProfile,type IBodyReference,type IBodyRegistry} from "@spacexr-service/shared";
/** Celestial-catalogue adapter. Defaults are referenced, never copied into a second physical database. */
export class BodyRegistry implements IBodyRegistry {
 private readonly bodies=new Map<string,IBodyReference>();
 /** Register selected profiles against an authoritative built-in or application-supplied celestial catalogue. */
 public constructor(profiles:readonly IBodyProfile[],private readonly catalogue:CelestialCatalogue=SolarSystemBodies){
  for(const profile of profiles){const body=Object.hasOwn(catalogue,profile.catalogueName)?catalogue[profile.catalogueName]:undefined;if(!body)throw new ServiceError(400,"UNKNOWN_BODY","Unknown celestial catalogue entry: "+profile.catalogueName);if(this.bodies.has(profile.id))throw new ServiceError(400,"DUPLICATE_BODY","Duplicate body reference profile");
   // Reading a Quantia quantity establishes the physical unit boundary; geometry remains geodesy's responsibility.
   body.meanRadius.getValue(Length.Units.m);
   this.bodies.set(profile.id,Object.freeze({id:profile.id,name:body.name,profile:Object.freeze({...profile}),semiMajorAxisMetres:body.ellipsoid.semiMajorAxis,semiMinorAxisMetres:body.ellipsoid.semiMinorAxis}));
  }
 }
 /** Selected body profiles in configuration order. */ public list():readonly IBodyReference[]{return[...this.bodies.values()];}
 /** Resolve an enabled body, or reject an unsupported reference. */ public get(id:string):IBodyReference{const body=this.bodies.get(id);if(!body)throw new ServiceError(404,"BODY_NOT_FOUND","Body is not enabled in this instance");return body;}
 /** Reference surface used for body-fixed Cartesian calculations. */ public system(id:string):GeodeticSystem{const body=this.get(id);return new GeodeticSystem(this.catalogue[body.profile.catalogueName]!.ellipsoid);}
 /** ENU tangent frame: east, north, up in metres at a geodetic degree anchor. */
 public tangent(id:string,latitudeDegrees:number,longitudeDegrees:number,heightMetres=0):LocalTangentPlane{return this.system(id).localTangentPlaneDegrees(latitudeDegrees,longitudeDegrees,heightMetres);}
}
`);

const planetary={service:{id:'planetary',name:'Planetary Tile Service',purpose:'planetary',baseUrl:'http://127.0.0.1:8787',adminOrigin:'http://127.0.0.1:5173',ownerTenant:'owner'},features:{tile2d:true,tiles3d:true,assetUpload:true,layerPublishing:true},catalog:{bodies:[['earth','Earth'],['moon','Moon'],['mars','Mars']].map(([id,catalogueName])=>({id,catalogueName,referenceFrame:'body-fixed:'+id,latitudeType:'planetographic',longitudeDirection:'east-positive',verticalDatum:'reference-ellipsoid'})),engineeringFrames:[]},quotas:{assetBytes:16777216,tenantStorageBytes:1073741824,layerObjects:10000,activeJobs:4,requestsPerMinute:600,builderObjects:100000},extensions:[]};
write('deployments/planetary.json',JSON.stringify(planetary,null,2));
const industrial=structuredClone(planetary);industrial.service={...industrial.service,id:'industrial',name:'Industrial Digital Twin',purpose:'industrial',baseUrl:'http://127.0.0.1:8788',adminOrigin:'http://127.0.0.1:5174'};industrial.features.tile2d=false;industrial.catalog={bodies:[],engineeringFrames:[{id:'factory-floor',name:'Factory floor',units:'m',axes:'right-handed-z-up'}]};write('deployments/industrial.json',JSON.stringify(industrial,null,2));
write('tools/generate-schemas.ts',`import {mkdir,writeFile} from "node:fs/promises";
import {compile} from "json-schema-to-typescript";
import {publicSchemas} from "../packages/shared/src/schemas";
await mkdir("schemas",{recursive:true});await mkdir("packages/shared/generated",{recursive:true});
for(const[name,schema]of Object.entries(publicSchemas)){
 await writeFile("schemas/"+name+".schema.json",JSON.stringify(schema,null,2)+"\\n");
 const types=await compile(schema,name,{bannerComment:"/** Generated from the shared JSON schema. Do not edit by hand. */",additionalProperties:false});
 await writeFile("packages/shared/generated/"+name+".d.ts",types);
}
console.log("Shared JSON schemas and TypeScript declarations generated");
`);
// Module placeholders are explicitly empty until their actual implementation is written.
for(const name of ['tile2d-core','tile2d-builder','tiles3d-builder','layer-service','storage'])write('packages/'+name+'/src/index.ts','export {};');
write('README.md',`# SpaceXR Tile Service

Independent Cloudflare geospatial publishing instances share one modular source tree. The platform uses the SpaceXR geographic 2x1 tile matrix, explicit reference frames and datums, immutable R2 revisions and asynchronous external processing.

See [architecture](docs/ARCHITECTURE.md) and [dependency audit](docs/DEPENDENCY-AUDIT.md). The authoritative libraries are sibling checkouts during development. Build their packages before installing this workspace. Quantia provides units; the public Terrarium encoder belongs to @spacexr/dem.

This repository contains no cloud credentials or pre-created Cloudflare resource identifiers. Scientific coverage is published only after product verification and successful ingestion. Synthetic fixtures are identified as synthetic.
`);
console.log('Service workspace, shared schemas and deployment profiles prepared.');
