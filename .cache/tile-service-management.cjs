const fs=require('node:fs'),path=require('node:path');
const root='C:/Users/GuillaumePelletier/Documents/GitHub/Gaume/spacexr-tile-service';
const read=f=>fs.readFileSync(path.join(root,f),'utf8').replace(/\r\n/g,'\n');
function write(f,t){fs.mkdirSync(path.dirname(path.join(root,f)),{recursive:true});fs.writeFileSync(path.join(root,f),t.trimStart().trimEnd()+'\n');}
write('packages/auth/package.json',JSON.stringify({name:'@spacexr-service/auth',version:'0.1.0',private:true,type:'module',exports:{'.':'./src/index.ts'}},null,2));
write('packages/auth/src/index.ts',read('apps/api/src/auth.ts'));
write('apps/api/src/auth.ts','export * from "@spacexr-service/auth";');
write('packages/shared/src/http.ts',read('apps/api/src/http.ts').replace('from "@spacexr-service/shared"','from "./errors"'));
write('apps/api/src/http.ts','export * from "@spacexr-service/shared";');
write('packages/shared/src/index.ts',read('packages/shared/src/index.ts')+'\nexport * from "./http";');
write('packages/shared/src/contracts.ts',read('packages/shared/src/contracts.ts').replace(' DB:D1Database;', ' DB:D1Database;').replace(' /** Explicit local-only upload mode;', ' /** Optional Cloudflare per-location rate limiter, namespaced by instance. */ API_LIMIT?:{limit(options:{key:string}):Promise<{success:boolean}>};\n /** Explicit local-only upload mode;').replace('request:Request;url:URL;principal?:IPrincipal;', 'request:Request;url:URL;principal?:IPrincipal;extensions?:readonly IServiceExtension[];'));
let app=read('apps/api/src/application.ts').replace('ServiceError,type','ServiceError,sha256,type').replace('request,url};','request,url,extensions};');
app=app.replace('   const identity=request.headers.get("authorization")??request.headers.get("cf-connecting-ip")??"anonymous";', '   const identity=config.service.id+":"+(request.headers.get("cf-connecting-ip")??"local");\n   if(env.API_LIMIT){const allowed=await env.API_LIMIT.limit({key:identity});if(!allowed.success)throw new ServiceError(429,"RATE_LIMITED","Request rate limit exceeded");}\n   else if(env.LOCAL_DEV!=="true")throw new ServiceError(503,"RATE_LIMIT_BINDING_REQUIRED","Production rate-limit binding is missing");');
// The local limiter is bounded; it does not store bearer tokens as map keys.
app=app.replace('let window=requests.get(identity);if(!window', 'let window=requests.get(identity);if(!window&&requests.size>=10000)throw new ServiceError(429,"RATE_LIMITED","Local rate limiter is full");if(!window');
app=app.replace('ServiceError,sha256,type','ServiceError,type');
app=app.replace('return json({status:"ok",instanceId:config.service.id,features:config.features});','return json({status:"ok",instanceId:config.service.id,features:config.features},200,{"access-control-allow-origin":"*"});');
app=app.replace('return json({items:bodies.list()});','return json({items:bodies.list()},200,{"access-control-allow-origin":"*"});').replace('return json(bodies.get(parts[2]!));','return json(bodies.get(parts[2]!),200,{"access-control-allow-origin":"*"});');
app=app.replace('return json({instanceId:config.service.id,tenantId:principal.tenantId,scopes:principal.scopes});','return json({instanceId:config.service.id,tenantId:principal.tenantId,scopes:principal.scopes},200,origin&&allowed?{"access-control-allow-origin":origin}:{});');
write('apps/api/src/application.ts',app);
let migration=read('migrations/0001_metadata.sql');
migration=migration.replace('revision TEXT NOT NULL,manifest TEXT NOT NULL','revision TEXT NOT NULL,visibility TEXT NOT NULL,manifest TEXT NOT NULL');
migration+='\nCREATE TABLE publication_counters (kind TEXT NOT NULL,resource_id TEXT NOT NULL,sequence INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(kind,resource_id));\n';
write('migrations/0001_metadata.sql',migration);
// Shared job IDs make repeated publish/finalize calls replayable without creating extra revisions.
write('packages/storage/src/jobs.ts',`import {ServiceError,sha256,type IServiceContext,type IJob} from "@spacexr-service/shared";
import {first,sql} from "./index";
/** Stable per-tenant operation identity when a caller supplies an idempotency key. */
export async function jobIdentity(context:IServiceContext,kind:IJob["kind"],resourceId:string):Promise<string>{const key=context.request.headers.get("idempotency-key");if(!key)return crypto.randomUUID();if(key.length>128||!key.trim())throw new ServiceError(400,"INVALID_IDEMPOTENCY_KEY","Idempotency key must be 1..128 characters");return"job-"+(await sha256(context.principal!.tenantId+":"+kind+":"+resourceId+":"+key)).slice(0,40);}
/** Read a previously submitted job in the current tenant boundary. */
export async function replayJob(context:IServiceContext,id:string):Promise<{id:string;payload:Record<string,unknown>}|undefined>{const row=await first<{id:string;payload:string}>(context,"SELECT id,payload FROM jobs WHERE id=? AND tenant_id=?",id,context.principal!.tenantId);return row?{id:row.id,payload:JSON.parse(row.payload) as Record<string,unknown>}:undefined;}
/** Allocate a monotonically increasing publication sequence. Gaps are harmless; revision objects remain immutable. */
export async function nextPublicationSequence(context:IServiceContext,kind:"layer"|"dataset",id:string):Promise<number>{await sql(context,"INSERT OR IGNORE INTO publication_counters(kind,resource_id) VALUES(?,?)",kind,id).run();const row=await sql(context,"UPDATE publication_counters SET sequence=sequence+1 WHERE kind=? AND resource_id=? RETURNING sequence",kind,id).first<{sequence:number}>();if(!row)throw new Error("Publication counter was not allocated");return row.sequence;}
`);
let storage=read('packages/storage/src/index.ts').replace('extra:D1PreparedStatement[]=[]):Promise<string>', 'extra:D1PreparedStatement[]=[],jobId?:string):Promise<string>').replace(' const id=crypto.randomUUID(),now=Date.now();',' const id=jobId??crypto.randomUUID(),now=Date.now();').replace('context.execution.waitUntil(flushOutbox(context));','context.execution.waitUntil(flushOutbox(context).catch(()=>undefined));');
storage+='\nexport * from "./jobs";\n';write('packages/storage/src/index.ts',storage);
write('packages/layer-service/src/index.ts',`import {Type} from "@sinclair/typebox";
import {ServiceError,json,parseSchema,safeId,readJson,pagination,LayerInputSchema,LayerUpdateSchema,PlacedAssetInputSchema,ObjectUpdateSchema,PublishInputSchema,sha256,type IServiceContext,type ICapability,type IPlacedAssetInput} from "@spacexr-service/shared";
import {authorize} from "@spacexr-service/auth";
import {sql,all,first,audit,getLayer,createJob,objectPrefix,jobIdentity,replayJob,nextPublicationSequence} from "@spacexr-service/storage";
function page<T extends {id:string}>(rows:T[],limit:number){return{items:rows.slice(0,limit),cursor:rows.length>limit?rows[limit-1]!.id:undefined};}
async function requirePlacement(context:IServiceContext,layerId:string,input:IPlacedAssetInput){const layer=await getLayer(context,layerId);if(Boolean(layer.bodyId)!==("longitude"in input.position))throw new ServiceError(400,"POSITION_FRAME_MISMATCH","Placement does not match the layer reference frame");const asset=await first<{id:string}>(context,"SELECT id FROM assets WHERE id=? AND tenant_id=? AND status='ready'",input.assetId,context.principal!.tenantId);if(!asset)throw new ServiceError(409,"ASSET_NOT_READY","Asset is not ready in this tenant");for(const extension of context.extensions??[]){extension.validatePlacement?.(input);if(extension.authorize&&!extension.authorize(context.principal!,"placement.write",layer))throw new ServiceError(403,"POLICY_DENIED","Extension policy rejected the operation");}return layer;}
/** Layer and object CRUD. All resource queries are explicitly tenant-scoped. */
export function layerCapability():ICapability{return{id:"layers",async handle(context,parts){
 if(parts[0]!=="layers")return undefined;const method=context.request.method;
 if(parts.length===2&&parts[1]&&parts[1]!=="undefined"&&parts[1]!=="null")safeId(parts[1]);
 if(parts.length===1&&method==="POST"){
  await authorize(context,"write");const input=parseSchema(LayerInputSchema,await readJson(context.request));if(Boolean(input.bodyId)===Boolean(input.frameId))throw new ServiceError(400,"REFERENCE_REQUIRED","Choose exactly one bodyId or engineering frameId");
  if(input.bodyId)context.bodies?.get(input.bodyId)??(()=>{throw new ServiceError(400,"BODY_NOT_ENABLED","Body registry is unavailable");})();
  if(input.frameId&&!context.config.catalog.engineeringFrames.some(frame=>frame.id===input.frameId))throw new ServiceError(400,"FRAME_NOT_ENABLED","Engineering frame is unavailable");
  for(const extension of context.extensions??[]){extension.validateLayer?.(input);if(extension.authorize&&!extension.authorize(context.principal!,"layer.create",input))throw new ServiceError(403,"POLICY_DENIED","Extension policy rejected the operation");}
  const id=crypto.randomUUID();await context.env.DB.batch([sql(context,"INSERT INTO layers(id,tenant_id,name,body_id,frame_id,visibility,metadata,created_at) VALUES(?,?,?,?,?,?,?,?)",id,context.principal!.tenantId,input.name,input.bodyId??null,input.frameId??null,input.visibility,JSON.stringify(input.metadata??{}),Date.now()),audit(context,"layer.create",id)]);return json(await getLayer(context,id),201);
 }
 if(parts.length===1&&method==="GET"){await authorize(context,"read");const{cursor,limit}=pagination(context.url);const rows=await all<{id:string;name:string;visibility:string;version:number}>(context,"SELECT id,name,visibility,version FROM layers WHERE tenant_id=? AND deleted=0 AND id>? ORDER BY id LIMIT ?",context.principal!.tenantId,cursor,limit+1);return json(page(rows,limit));}
 const id=parts[1];if(!id)return undefined;
 // Static and private revision delivery belongs to the delivery capability, not mutable CRUD.
 if(parts[2]==="tileset.json"||parts[2]==="revisions")return undefined;
 if(parts.length===2&&method==="GET"){await authorize(context,"read");return json(await getLayer(context,id));}
 if(parts.length===2&&method==="PATCH"){
  await authorize(context,"write");const input=parseSchema(LayerUpdateSchema,await readJson(context.request)),layer=await getLayer(context,id);if(layer.version!==input.version)throw new ServiceError(409,"VERSION_CONFLICT","Draft version changed");if(layer.activeRevision&&layer.visibility==="public"&&input.visibility==="private")throw new ServiceError(409,"PUBLIC_REVISION_EXISTS","Existing public immutable revisions cannot become private; create a private layer");
  const results=await context.env.DB.batch([sql(context,"UPDATE layers SET name=?,visibility=?,version=version+1,status='draft' WHERE id=? AND tenant_id=? AND version=?",input.name??layer.name,input.visibility??layer.visibility,id,context.principal!.tenantId,input.version),audit(context,"layer.update",id)]);if(!results[0]!.meta.changes)throw new ServiceError(409,"VERSION_CONFLICT","Draft version changed");return json(await getLayer(context,id));
 }
 if(parts.length===2&&method==="DELETE"){await authorize(context,"write");await getLayer(context,id);await context.env.DB.batch([sql(context,"UPDATE layers SET deleted=1 WHERE id=? AND tenant_id=?",id,context.principal!.tenantId),audit(context,"layer.delete",id)]);return new Response(null,{status:204});}
 if(parts[2]==="objects"&&parts.length===3&&method==="GET"){await authorize(context,"read");await getLayer(context,id);const{cursor,limit}=pagination(context.url);const rows=await all<{id:string;version:number;data:string}>(context,"SELECT id,version,data FROM objects WHERE layer_id=? AND tenant_id=? AND id>? ORDER BY id LIMIT ?",id,context.principal!.tenantId,cursor,limit+1);return json({...page(rows,limit),items:rows.slice(0,limit).map(row=>({...JSON.parse(row.data) as object,id:row.id,version:row.version,layerId:id}))});}
 if(parts[2]==="objects"&&parts.length===3&&method==="POST"){
  await authorize(context,"write");const input=parseSchema(PlacedAssetInputSchema,await readJson(context.request));await requirePlacement(context,id,input);const objectId=crypto.randomUUID();await context.env.DB.batch([sql(context,"INSERT INTO objects(id,layer_id,tenant_id,asset_id,data,created_at) VALUES(?,?,?,?,?,?)",objectId,id,context.principal!.tenantId,input.assetId,JSON.stringify(input),Date.now()),audit(context,"object.create",objectId)]);return json({...input,id:objectId,layerId:id,version:1,layerVersion:(await getLayer(context,id)).version},201);
 }
 if(parts[2]==="objects"&&parts[3]&&parts.length===4&&method==="PATCH"){
  await authorize(context,"write");const{version,...input}=parseSchema(ObjectUpdateSchema,await readJson(context.request));await requirePlacement(context,id,input);const row=await first<{version:number}>(context,"SELECT version FROM objects WHERE id=? AND layer_id=? AND tenant_id=?",safeId(parts[3]),id,context.principal!.tenantId);if(!row)throw new ServiceError(404,"OBJECT_NOT_FOUND","Object not found");if(row.version!==version)throw new ServiceError(409,"VERSION_CONFLICT","Object version changed");const results=await context.env.DB.batch([sql(context,"UPDATE objects SET asset_id=?,data=?,version=version+1 WHERE id=? AND layer_id=? AND tenant_id=? AND version=?",input.assetId,JSON.stringify(input),parts[3],id,context.principal!.tenantId,version),audit(context,"object.update",parts[3])]);if(!results[0]!.meta.changes)throw new ServiceError(409,"VERSION_CONFLICT","Object version changed");return json({...input,id:parts[3],layerId:id,version:version+1,layerVersion:(await getLayer(context,id)).version});
 }
 if(parts[2]==="objects"&&parts[3]&&parts.length===4&&method==="DELETE"){
  await authorize(context,"write");await getLayer(context,id);const result=await sql(context,"DELETE FROM objects WHERE id=? AND layer_id=? AND tenant_id=?",safeId(parts[3]),id,context.principal!.tenantId).run();if(!result.meta.changes)throw new ServiceError(404,"OBJECT_NOT_FOUND","Object not found");await audit(context,"object.delete",parts[3]).run();return new Response(null,{status:204});
 }
 if(parts[2]==="publish"&&parts.length===3&&method==="POST"){
  if(!context.config.features.layerPublishing)throw new ServiceError(404,"NOT_FOUND","Publishing is disabled");await authorize(context,"publish");const input=parseSchema(PublishInputSchema,await readJson(context.request));const layer=await getLayer(context,id),jobId=await jobIdentity(context,"layer-publish",id),replay=await replayJob(context,jobId);if(replay){if(replay.payload.sourceVersion!==input.version)throw new ServiceError(409,"IDEMPOTENCY_CONFLICT","Idempotency key was used for another draft version");return json({jobId:replay.id},202);}if(layer.version!==input.version)throw new ServiceError(409,"VERSION_CONFLICT","Draft version changed");
  const objects=await all<{id:string;data:string;canonical_key:string;asset_id:string}>(context,"SELECT o.id,o.data,o.asset_id,a.canonical_key FROM objects o JOIN assets a ON a.id=o.asset_id WHERE o.layer_id=? AND o.tenant_id=? AND a.status='ready' ORDER BY o.id LIMIT ?",id,context.principal!.tenantId,context.config.quotas.layerObjects+1);if(!objects.length)throw new ServiceError(409,"EMPTY_LAYER","Layer has no ready objects");if(objects.length>context.config.quotas.layerObjects)throw new ServiceError(429,"OBJECT_QUOTA","Layer object quota exceeded");
  const snapshot=objects.map(row=>({id:row.id,...JSON.parse(row.data) as IPlacedAssetInput,canonicalKey:row.canonical_key}));
  if(snapshot.some(object=>"altitudeMode"in object.position&&object.position.altitudeMode==="relative-to-ground"))throw new ServiceError(409,"GROUND_DATUM_REQUIRED","Terrain-relative placement requires an explicit compatible ground-sampling extension");
  const sequence=await nextPublicationSequence(context,"layer",id),revision=jobId,rootKey=objectPrefix(context.config.service.id,context.principal!.tenantId,"layers",id,revision);
  const payload={layer,objects:snapshot,revision,sequence,sourceVersion:input.version,rootKey,body:layer.bodyId?context.bodies!.get(layer.bodyId):undefined,frame:layer.frameId?context.config.catalog.engineeringFrames.find(frame=>frame.id===layer.frameId):undefined};
  await createJob(context,"layer-publish",id,payload,[sql(context,"INSERT INTO revisions(id,layer_id,tenant_id,sequence,source_version,visibility,root_key,created_at) SELECT ?,id,tenant_id,?,?,visibility,?,? FROM layers WHERE id=? AND tenant_id=? AND version=?",revision,sequence,input.version,rootKey,Date.now(),id,context.principal!.tenantId,input.version)],jobId);return json({jobId,revision},202);
 }
 return undefined;
}};}
/** Scoped token issuance and audit access are separate from body/layer business modules. */
export function tenantCapability():ICapability{return{id:"tenants",async handle(context,parts){
 if(parts[0]==="tokens"&&parts.length===1&&context.request.method==="POST"){
  await authorize(context,"admin");const input=parseSchema(Type.Object({tenantId:Type.String({pattern:"^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$"}),scopes:Type.Array(Type.Union([Type.Literal("read"),Type.Literal("write"),Type.Literal("publish")])),expiresInSeconds:Type.Integer({minimum:60,maximum:31536000})},{additionalProperties:false}),await readJson(context.request));
  await sql(context,"INSERT OR IGNORE INTO tenants(id,storage_limit,object_limit,job_limit) VALUES(?,?,?,?)",input.tenantId,context.config.quotas.tenantStorageBytes,context.config.quotas.layerObjects,context.config.quotas.activeJobs).run();const token=crypto.randomUUID()+crypto.randomUUID(),hash=await sha256(context.config.service.id+":"+token);await context.env.DB.batch([sql(context,"INSERT INTO api_tokens(hash,tenant_id,subject,scopes,expires_at) VALUES(?,?,?,?,?)",hash,input.tenantId,"token-"+hash.slice(0,12),JSON.stringify(input.scopes),Date.now()+input.expiresInSeconds*1000),audit(context,"token.create",input.tenantId)]);return json({token,tenantId:input.tenantId,scopes:input.scopes},201);
 }
 if(parts[0]==="audit"&&context.request.method==="GET"){await authorize(context,"read");const{cursor,limit}=pagination(context.url);const rows=await all<{id:string;operation:string;resource_id:string;created_at:number}>(context,"SELECT id,operation,resource_id,created_at FROM audit_log WHERE tenant_id=? AND id>? ORDER BY id LIMIT ?",context.principal!.tenantId,cursor,limit+1);return json(page(rows,limit));}
 if(parts[0]==="jobs"&&parts.length===2&&context.request.method==="GET"){await authorize(context,"read");const job=await first<Record<string,unknown>>(context,"SELECT id,kind,resource_id,status,error,created_at,updated_at FROM jobs WHERE id=? AND tenant_id=?",safeId(parts[1]!),context.principal!.tenantId);if(!job)throw new ServiceError(404,"JOB_NOT_FOUND","Job not found");return json(job);}
 return undefined;
}};}
`);
console.log('Tenant-scoped layer/object APIs, optimistic versions, publishing snapshots and queue outbox prepared.');
