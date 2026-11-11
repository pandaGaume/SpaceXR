const fs=require('node:fs'),path=require('node:path');
const root='C:/Users/GuillaumePelletier/Documents/GitHub/Gaume/spacexr-tile-service';
function write(f,t){fs.mkdirSync(path.dirname(path.join(root,f)),{recursive:true});fs.writeFileSync(path.join(root,f),t.trimStart().trimEnd()+'\n');}
write('migrations/0001_metadata.sql',`PRAGMA foreign_keys = ON;
CREATE TABLE service_identity (singleton INTEGER PRIMARY KEY CHECK(singleton=1), instance_id TEXT NOT NULL);
CREATE TABLE tenants (id TEXT PRIMARY KEY, storage_limit INTEGER NOT NULL, object_limit INTEGER NOT NULL, job_limit INTEGER NOT NULL);
CREATE TABLE api_tokens (hash TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id), subject TEXT NOT NULL, scopes TEXT NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE layers (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id), name TEXT NOT NULL, body_id TEXT, frame_id TEXT, visibility TEXT NOT NULL CHECK(visibility IN ('public','private')), status TEXT NOT NULL DEFAULT 'draft', version INTEGER NOT NULL DEFAULT 1, publish_sequence INTEGER NOT NULL DEFAULT 0, active_sequence INTEGER NOT NULL DEFAULT 0, active_revision TEXT, metadata TEXT NOT NULL DEFAULT '{}', deleted INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, CHECK((body_id IS NULL) <> (frame_id IS NULL)));
CREATE INDEX layers_owner ON layers(tenant_id,id);
CREATE TABLE assets (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id), name TEXT NOT NULL, expected_hash TEXT NOT NULL, byte_length INTEGER NOT NULL, content_type TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'quarantined', object_key TEXT NOT NULL, canonical_key TEXT, metadata TEXT, created_at INTEGER NOT NULL, error TEXT);
CREATE INDEX assets_owner ON assets(tenant_id,id);
CREATE TABLE objects (id TEXT PRIMARY KEY, layer_id TEXT NOT NULL REFERENCES layers(id), tenant_id TEXT NOT NULL REFERENCES tenants(id), asset_id TEXT NOT NULL REFERENCES assets(id), version INTEGER NOT NULL DEFAULT 1, data TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE INDEX objects_layer ON objects(layer_id,tenant_id,id);
CREATE TRIGGER asset_quota BEFORE INSERT ON assets BEGIN
 SELECT CASE WHEN COALESCE((SELECT SUM(byte_length) FROM assets WHERE tenant_id=NEW.tenant_id AND status IN ('quarantined','validating','ready')),0)+NEW.byte_length > (SELECT storage_limit FROM tenants WHERE id=NEW.tenant_id) THEN RAISE(ABORT,'TENANT_STORAGE_QUOTA') END;
END;
CREATE TRIGGER object_quota BEFORE INSERT ON objects BEGIN
 SELECT CASE WHEN (SELECT COUNT(*) FROM objects WHERE layer_id=NEW.layer_id)>=(SELECT object_limit FROM tenants WHERE id=NEW.tenant_id) THEN RAISE(ABORT,'LAYER_OBJECT_QUOTA') END;
END;
CREATE TRIGGER object_insert AFTER INSERT ON objects BEGIN UPDATE layers SET version=version+1,status='draft' WHERE id=NEW.layer_id; END;
CREATE TRIGGER object_update AFTER UPDATE ON objects BEGIN UPDATE layers SET version=version+1,status='draft' WHERE id=NEW.layer_id; END;
CREATE TRIGGER object_delete AFTER DELETE ON objects BEGIN UPDATE layers SET version=version+1,status='draft' WHERE id=OLD.layer_id; END;
CREATE TABLE jobs (id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL REFERENCES tenants(id),kind TEXT NOT NULL,resource_id TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'queued',payload TEXT NOT NULL,lease_token TEXT,lease_until INTEGER,attempts INTEGER NOT NULL DEFAULT 0,error TEXT,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL);
CREATE INDEX jobs_claim ON jobs(status,lease_until,created_at);
CREATE TRIGGER job_quota BEFORE INSERT ON jobs BEGIN
 SELECT CASE WHEN (SELECT COUNT(*) FROM jobs WHERE tenant_id=NEW.tenant_id AND status IN ('queued','running'))>=(SELECT job_limit FROM tenants WHERE id=NEW.tenant_id) THEN RAISE(ABORT,'ACTIVE_JOB_QUOTA') END;
END;
CREATE TABLE outbox (job_id TEXT PRIMARY KEY REFERENCES jobs(id),sent_at INTEGER);
CREATE TABLE revisions (id TEXT PRIMARY KEY,layer_id TEXT NOT NULL REFERENCES layers(id),tenant_id TEXT NOT NULL REFERENCES tenants(id),sequence INTEGER NOT NULL,source_version INTEGER NOT NULL,visibility TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'staging',root_key TEXT NOT NULL,created_at INTEGER NOT NULL,UNIQUE(layer_id,sequence));
CREATE TABLE datasets (id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL REFERENCES tenants(id),body_id TEXT NOT NULL,revision TEXT NOT NULL,manifest TEXT NOT NULL,created_at INTEGER NOT NULL);
CREATE TABLE audit_log (id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,subject TEXT NOT NULL,operation TEXT NOT NULL,resource_id TEXT,created_at INTEGER NOT NULL);
CREATE TABLE idempotency (tenant_id TEXT NOT NULL,operation TEXT NOT NULL,key TEXT NOT NULL,input_hash TEXT NOT NULL,response TEXT NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(tenant_id,operation,key));
`);
write('packages/storage/src/index.ts',`import type {D1PreparedStatement,R2Bucket} from "@cloudflare/workers-types";
import {ServiceError,safeId,safePath,sha256,type IServiceContext,type ILayer,type IJob} from "@spacexr-service/shared";
const initialized=new WeakMap<object,Promise<void>>();
/** Enforce the database instance boundary before management operations. No public tile path calls this function. */
export async function ensureDatabase(context:IServiceContext):Promise<void>{
 const database=context.env.DB;let pending=initialized.get(database);
 if(!pending){pending=(async()=>{const id=context.config.service.id;await database.prepare("INSERT OR IGNORE INTO service_identity(singleton,instance_id) VALUES(1,?)").bind(id).run();const row=await database.prepare("SELECT instance_id FROM service_identity WHERE singleton=1").first<{instance_id:string}>();if(row?.instance_id!==id)throw new ServiceError(503,"INSTANCE_BINDING_MISMATCH","Database belongs to another instance");await database.prepare("INSERT OR IGNORE INTO tenants(id,storage_limit,object_limit,job_limit) VALUES(?,?,?,?)").bind(context.config.service.ownerTenant,context.config.quotas.tenantStorageBytes,context.config.quotas.layerObjects,context.config.quotas.activeJobs).run();})();initialized.set(database,pending);pending.catch(()=>initialized.delete(database));}
 await pending;
}
/** Parameterized metadata statement. Identifiers are fixed in source; request values are bound. */
export function sql(context:IServiceContext,statement:string,...values:unknown[]):D1PreparedStatement{return context.env.DB.prepare(statement).bind(...values);}
/** Read one typed row without inventing defaults for a missing entity. */
export async function first<T>(context:IServiceContext,statement:string,...values:unknown[]):Promise<T|undefined>{return(await sql(context,statement,...values).first<T>())??undefined;}
/** Read a bounded query result. Callers provide pagination limits. */
export async function all<T>(context:IServiceContext,statement:string,...values:unknown[]):Promise<T[]>{return(await sql(context,statement,...values).all<T>()).results;}
/** Immutable object namespace, independent of the public URL layout. */
export function objectPrefix(instanceId:string,tenantId:string,kind:string,id:string,revision?:string):string{return["instances",safeId(instanceId),"tenants",safeId(tenantId),safeId(kind),safeId(id),...revision?["revisions",safeId(revision)]:[]].join("/");}
/** Public pointer is an atomic R2 value; its target is an immutable revision. */
export interface IPublicPointer {instanceId:string;resourceId:string;revision:string;sequence:number;rootKey:string;tenantId:string;kind:"layer"|"dataset";}
/** Dedicated public namespace. A private object is never written here by accident. */
export function pointerKey(instanceId:string,kind:"layers"|"datasets",id:string):string{return["instances",safeId(instanceId),"catalog",kind,safeId(id)+".json"].join("/");}
/** Compare-and-swap an active pointer. A slow older build cannot replace a newer revision. */
export async function activatePointer(bucket:R2Bucket,key:string,pointer:IPublicPointer):Promise<boolean>{
 for(let attempt=0;attempt<12;attempt++){
  const current=await bucket.get(key);const old=current?await current.json<IPublicPointer>():undefined;
  if(old&&old.sequence>pointer.sequence)return false;
  if(old&&old.sequence===pointer.sequence){if(old.revision!==pointer.revision)throw new ServiceError(409,"PUBLICATION_CONFLICT","Revision sequence conflict");return true;}
  const written=await bucket.put(key,JSON.stringify(pointer),{onlyIf:current?{etagMatches:current.etag}:{etagDoesNotMatch:"*"},httpMetadata:{contentType:"application/json",cacheControl:"public, max-age=30"}});
  if(written)return true;
 }
 throw new ServiceError(409,"PUBLICATION_BUSY","Active publication changed concurrently; retry the job");
}
/** Write-once object upload with a trusted builder digest and idempotent replay. */
export async function putImmutable(bucket:R2Bucket,key:string,bytes:Uint8Array,contentType:string,hash?:string):Promise<void>{
 const digest=hash??await sha256(bytes);const existing=await bucket.head(key);
 if(existing){if(existing.customMetadata?.sha256!==digest)throw new ServiceError(409,"IMMUTABLE_OBJECT_CONFLICT","Published object bytes cannot be overwritten");return;}
 const written=await bucket.put(key,bytes.slice().buffer,{onlyIf:{etagDoesNotMatch:"*"},customMetadata:{sha256:digest},httpMetadata:{contentType,cacheControl:"public, max-age=31536000, immutable"}});
 if(!written){const concurrent=await bucket.head(key);if(concurrent?.customMetadata?.sha256!==digest)throw new ServiceError(409,"IMMUTABLE_OBJECT_CONFLICT","Concurrent object differs");}
}
/** Serve bytes with immutable public caching or private no-store, using the actual stored content type. */
export async function serveObject(bucket:R2Bucket,key:string,isPublic:boolean):Promise<Response>{
 const object=await bucket.get(key);if(!object)throw new ServiceError(404,"OBJECT_NOT_FOUND","Resource not found");
 const headers=new Headers({"content-type":object.httpMetadata?.contentType??"application/octet-stream","etag":object.httpEtag,"cache-control":isPublic?"public, max-age=31536000, immutable":"private, no-store","x-content-type-options":"nosniff"});if(isPublic)headers.set("access-control-allow-origin","*");return new Response(object.body as unknown as BodyInit,{headers});
}
/** Persist a small safe audit record alongside a management mutation. */
export function audit(context:IServiceContext,operation:string,id?:string):D1PreparedStatement{const principal=context.principal!;return sql(context,"INSERT INTO audit_log(id,tenant_id,subject,operation,resource_id,created_at) VALUES(?,?,?,?,?,?)",crypto.randomUUID(),principal.tenantId,principal.subject,operation,id??null,Date.now());}
/** Tenant-scoped layer lookup. An unauthorized identifier is indistinguishable from an unknown one. */
export async function getLayer(context:IServiceContext,id:string):Promise<ILayer>{
 const row=await first<Record<string,unknown>>(context,"SELECT * FROM layers WHERE id=? AND tenant_id=? AND deleted=0",safeId(id),context.principal!.tenantId);if(!row)throw new ServiceError(404,"LAYER_NOT_FOUND","Layer not found");return{id:String(row.id),tenantId:String(row.tenant_id),name:String(row.name),bodyId:row.body_id?String(row.body_id):undefined,frameId:row.frame_id?String(row.frame_id):undefined,visibility:row.visibility as ILayer["visibility"],status:row.status as ILayer["status"],version:Number(row.version),activeRevision:row.active_revision?String(row.active_revision):undefined,metadata:JSON.parse(String(row.metadata)) as Record<string,unknown>};
}
/** Persist a replayable job and its queue outbox record in one database batch. */
export async function createJob(context:IServiceContext,kind:IJob["kind"],resourceId:string,payload:Record<string,unknown>,extra:D1PreparedStatement[]=[]):Promise<string>{
 const id=crypto.randomUUID(),now=Date.now();await context.env.DB.batch([...extra,sql(context,"INSERT INTO jobs(id,tenant_id,kind,resource_id,payload,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",id,context.principal!.tenantId,kind,resourceId,JSON.stringify(payload),now,now),sql(context,"INSERT INTO outbox(job_id) VALUES(?)",id),audit(context,"job.create",id)]);context.execution.waitUntil(flushOutbox(context));return id;
}
/** Queue delivery may repeat; the job lease, not a message, owns processing authority. */
export async function flushOutbox(context:IServiceContext):Promise<void>{if(!context.env.JOBS)return;const pending=await all<{job_id:string}>(context,"SELECT job_id FROM outbox WHERE sent_at IS NULL LIMIT 20");for(const item of pending){await context.env.JOBS.send({jobId:item.job_id,instanceId:context.config.service.id});await sql(context,"UPDATE outbox SET sent_at=? WHERE job_id=?",Date.now(),item.job_id).run();}}
/** Validate a relative resource path below an immutable publication root. */
export function revisionPath(rootKey:string,path:string):string{return rootKey+"/"+safePath(path);}
`);

write('apps/api/src/auth.ts',`import {ServiceError,sha256,type IPrincipal,type IServiceContext} from "@spacexr-service/shared";
import {ensureDatabase,first} from "@spacexr-service/storage";
function equalHash(left:string,right:string):boolean{let difference=left.length^right.length;for(let index=0;index<Math.max(left.length,right.length);index++)difference|=(left.charCodeAt(index)||0)^(right.charCodeAt(index)||0);return difference===0;}
/** Resolve scoped opaque API tokens. Builder credentials never authorize user management routes. */
export async function authorize(context:IServiceContext,scope:string):Promise<IPrincipal>{
 const header=context.request.headers.get("authorization");if(!header?.startsWith("Bearer "))throw new ServiceError(401,"AUTHENTICATION_REQUIRED","Bearer token required");const token=header.slice(7);if(token.length<16||token.length>512)throw new ServiceError(401,"INVALID_TOKEN","Invalid token");
 const hash=await sha256(context.config.service.id+":"+token);let principal:IPrincipal|undefined;
 if(context.env.BUILD_TOKEN&&equalHash(hash,await sha256(context.config.service.id+":"+context.env.BUILD_TOKEN)))principal={tenantId:"_builder",subject:"builder",scopes:["build"],kind:"builder"};
 else if(context.env.OWNER_TOKEN&&equalHash(hash,await sha256(context.config.service.id+":"+context.env.OWNER_TOKEN)))principal={tenantId:context.config.service.ownerTenant,subject:"owner",scopes:["read","write","publish","admin"],kind:"owner"};
 else{
  await ensureDatabase(context);
  const row=await first<{tenant_id:string;subject:string;scopes:string;expires_at:number}>(context,"SELECT tenant_id,subject,scopes,expires_at FROM api_tokens WHERE hash=?",hash);
  if(row&&row.expires_at>Date.now())principal={tenantId:row.tenant_id,subject:row.subject,scopes:JSON.parse(row.scopes) as string[],kind:"token"};
 }
 if(!principal)throw new ServiceError(401,"INVALID_TOKEN","Invalid or expired token");if(!principal.scopes.includes(scope))throw new ServiceError(403,"INSUFFICIENT_SCOPE","Token does not permit this operation");context.principal=principal;await ensureDatabase(context);return principal;
}
`);
write('apps/api/src/http.ts',`import {ServiceError} from "@spacexr-service/shared";
/** Bounded request reader. A misleading Content-Length never bypasses the actual byte limit. */
export async function readBytes(request:Request,maximum:number):Promise<Uint8Array>{
 if(Number(request.headers.get("content-length")??0)>maximum)throw new ServiceError(413,"PAYLOAD_TOO_LARGE","Payload exceeds configured limit");if(!request.body)return new Uint8Array();const reader=request.body.getReader(),parts:Uint8Array[]=[];let size=0;
 try{for(;;){const{done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maximum){await reader.cancel();throw new ServiceError(413,"PAYLOAD_TOO_LARGE","Payload exceeds configured limit");}parts.push(value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.byteLength;}return bytes;
}
/** Parse JSON with bounded depth and size before schema validation. */
export async function readJson(request:Request):Promise<unknown>{
 if(!request.headers.get("content-type")?.startsWith("application/json"))throw new ServiceError(415,"JSON_REQUIRED","Content-Type application/json is required");
 let value:unknown;try{value=JSON.parse(new TextDecoder().decode(await readBytes(request,1048576))) as unknown;}catch(error){if(error instanceof ServiceError)throw error;throw new ServiceError(400,"INVALID_JSON","Malformed JSON");}
 const pending:[unknown,number][]=[[value,0]];let count=0;while(pending.length){const[item,depth]=pending.pop()!;if(depth>40||++count>100000)throw new ServiceError(400,"JSON_COMPLEXITY","JSON nesting or value count is excessive");if(item&&typeof item==="object")for(const child of Object.values(item))pending.push([child,depth+1]);}return value;
}
/** Bounded cursor pagination. IDs are stable; runtime tile keys are never business identifiers. */
export function pagination(url:URL):{cursor:string;limit:number}{const cursor=url.searchParams.get("cursor")??"";if(cursor&&!/^[a-zA-Z0-9_-]{1,80}$/.test(cursor))throw new ServiceError(400,"INVALID_CURSOR","Invalid cursor");const limit=Number(url.searchParams.get("limit")??50);if(!Number.isInteger(limit)||limit<1||limit>100)throw new ServiceError(400,"INVALID_LIMIT","Limit must be 1..100");return{cursor,limit};}
`);
write('apps/api/src/application.ts',`import {json,parseSchema,ServiceConfigSchema,ServiceError,type IServiceConfig,type IServiceContext,type ICapability,type IBodyRegistry,type IBindings,type IExecutionContext,type IServiceExtension} from "@spacexr-service/shared";
import {authorize} from "./auth";
/** Compose only explicitly selected route capabilities. Disabled modules need not be imported by an entry point. */
export function createApplication(configuration:IServiceConfig,capabilities:readonly ICapability[],bodies?:IBodyRegistry,extensions:readonly IServiceExtension[]=[]){
 const config=parseSchema(ServiceConfigSchema,configuration);
 if(config.features.layerPublishing&&!config.features.tiles3d)throw new Error("Layer publishing requires 3D layers");
 if(config.extensions.some(id=>!extensions.some(extension=>extension.id===id)))throw new Error("A configured extension is not installed");
 const requests=new Map<string,{count:number;until:number}>();
 return{async fetch(request:Request,env:IBindings,execution:IExecutionContext):Promise<Response>{
  const url=new URL(request.url),requestId=crypto.randomUUID();const context:IServiceContext={config,env,execution,bodies,request,url};
  const origin=request.headers.get("origin"),allowed=origin===config.service.adminOrigin||origin===new URL(config.service.baseUrl).origin;
  try{
   if(origin&&request.headers.has("authorization")&&!allowed)throw new ServiceError(403,"ORIGIN_NOT_ALLOWED","Origin is not authorized");
   if(request.method==="OPTIONS"){if(!allowed)throw new ServiceError(403,"ORIGIN_NOT_ALLOWED","Origin is not authorized");return new Response(null,{status:204,headers:{"access-control-allow-origin":origin!,"access-control-allow-methods":"GET,POST,PATCH,PUT,DELETE,OPTIONS","access-control-allow-headers":"authorization,content-type,idempotency-key,x-job-lease","access-control-max-age":"600"}});}
   const identity=request.headers.get("authorization")??request.headers.get("cf-connecting-ip")??"anonymous";const now=Date.now();let window=requests.get(identity);if(!window||window.until<=now){window={count:0,until:now+60000};requests.set(identity,window);}if(++window.count>config.quotas.requestsPerMinute)throw new ServiceError(429,"RATE_LIMITED","Request rate limit exceeded");if(requests.size>10000)for(const[key,value]of requests)if(value.until<now)requests.delete(key);
   if(url.pathname==="/health")return json({status:"ok",instanceId:config.service.id,features:config.features});
   const parts=url.pathname.split("/").filter(Boolean);if(parts[0]!=="v1")throw new ServiceError(404,"NOT_FOUND","Route not found");
   if(parts[1]==="bodies"&&request.method==="GET"&&bodies){if(parts.length===2)return json({items:bodies.list()});if(parts.length===3)return json(bodies.get(parts[2]!));}
   // Every capability owns its schema and authorization checks; public delivery does not acquire a DB principal.
   for(const capability of capabilities){const response=await capability.handle(context,parts.slice(1));if(response){const headers=new Headers(response.headers);headers.set("x-request-id",requestId);headers.set("x-content-type-options","nosniff");if(origin&&allowed)headers.set("access-control-allow-origin",origin);return new Response(response.body,{status:response.status,headers});}}
   if(parts[1]==="whoami"){const principal=await authorize(context,"read");return json({instanceId:config.service.id,tenantId:principal.tenantId,scopes:principal.scopes});}
   throw new ServiceError(404,"NOT_FOUND","Route not found");
  }catch(error){const known=error instanceof ServiceError;const quota=!known&&error instanceof Error&&/QUOTA/.test(error.message);return json({error:{code:known?error.code:quota?"QUOTA_EXCEEDED":"INTERNAL_ERROR",message:known?error.message:quota?"Configured quota exceeded":"Request failed",requestId,...known&&error.details?{details:error.details}:{}}},known?error.status:quota?429:500,origin&&allowed?{"access-control-allow-origin":origin}:{});}
 }};
}
`);
console.log('D1 model, immutable storage ports, authentication and composable API foundation prepared.');
