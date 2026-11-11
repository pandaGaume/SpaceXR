import { createServer, type Server } from "node:http";
import { readFile } from "node:fs/promises";
import { sha256, storagePath } from "./storage";
import type { IGlobalManifest } from "./global";
import type { IGlobalFile } from "./global-kernel";
import { comparisonTile, type MoonHeightVariant } from "./sldem2015-comparison";

const PAGE = `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>Lune entière</title><style>body{max-width:1100px;margin:32px auto;padding:0 24px;background:#101827;color:#e6edf5;font:16px system-ui}p{line-height:1.6}section{padding:22px;background:#192538;border-radius:12px;margin:24px 0}a{color:#9dd2ff}input,select,button{padding:8px;margin:5px;background:#273b55;color:white;border:1px solid #69839d;border-radius:5px}input{width:70px}.faces{display:grid;grid-template-columns:repeat(3,1fr);gap:15px}.faces img{width:100%}.tile{display:flex;gap:20px;flex-wrap:wrap}.tile img,canvas{max-width:100%;height:auto}figure{margin:0}figcaption{font-size:14px;color:#b6cadf}progress{width:100%}code{overflow-wrap:anywhere}@media(max-width:600px){.faces{grid-template-columns:repeat(2,1fr)}}</style>
<h1>Lune entière</h1><p>Six faces cubiques, avec relief Terrarium et imagerie WebP. Tous les niveaux parents sont présents. Le relief utilise les fichiers numériques LOLA PDS ; l'imagerie NASA 16K reste un produit de visualisation.</p>
<section><h2>Génération</h2><p id="status">Lecture de la progression...</p><progress id="progress" max="100" value="0"></progress><p id="details"></p></section>
<div id="ready" hidden><p><a href="/elevation.json">Descripteur du relief</a> · <a href="/imagery.json">Descripteur de l'imagerie</a> · <a href="/sources.json">Sources globales</a> · <a href="/sldem2015.json">Sources SLDEM2015</a> · <a href="/shackleton.json">Raffinement Shackleton et sources PGDA81</a> · <a href="/height-ranges.json">Plages de hauteur par tuile</a></p>
<section><h2>Couverture globale</h2><div id="faces" class="faces"></div></section>
<section><h2>Comparer les modèles de terrain</h2><p>Les quatre couches utilisent la même tuile cubique et le même référentiel. La différence est SLDEM2015 moins LOLA aux mêmes sommets de sortie. La couche fusionnée raccorde LOLA au bord de la couverture de SLDEM2015. LOLA utilise ici la grille globale disponible à 128 pixels par degré; SLDEM2015 est à 512 pixels par degré.</p><form id="selection"><label>Source <select id="variant"><option value="fused">SLDEM2015 avec raccord LOLA</option><option value="lola">LOLA seul</option><option value="sldem2015">SLDEM2015 seul</option><option value="delta">Différence SLDEM2015 − LOLA</option></select></label><label>Face <select id="face"><option selected>0</option><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></select></label><label>Niveau <input id="lod" type="number" min="0" max="11" value="7"></label><label>X <input id="x" type="number" min="0" value="52"></label><label>Y <input id="y" type="number" min="0" value="52"></label><button>Afficher</button></form>
<p id="tile-info"></p><div class="tile"><figure><img id="image" width="257" height="257" alt="Imagerie de la tuile"><figcaption>Imagerie WebP</figcaption></figure><figure><canvas id="dem" width="257" height="257"></canvas><figcaption id="dem-caption">Relief SLDEM2015 avec raccord LOLA</figcaption></figure></div></section></div>
<script type="module">
let summary;
async function show(){const lod=Math.max(0,Math.min(summary.comparisonMaxLOD,Number(document.querySelector('#lod').value))),n=2**lod;document.querySelector('#lod').value=lod;const values=['x','y'].map(id=>{const e=document.querySelector('#'+id);e.max=n-1;e.value=Math.max(0,Math.min(n-1,Number(e.value)));return Number(e.value)}),face=document.querySelector('#face').value,path=[face,lod,...values].join('/'),variant=document.querySelector('#variant').value,info=await fetch('/comparison-info/'+variant+'/'+path+'.json').then(r=>{if(!r.ok)throw Error(r.status===404?'La source SLDEM2015 doit être importée avant comparaison.':'Tuile indisponible');return r.json()}),imageLOD=Math.min(lod,summary.imageryMaxLOD),imageScale=2**(lod-imageLOD),imagePath=[face,imageLOD,Math.floor(values[0]/imageScale),Math.floor(values[1]/imageScale)].join('/');document.querySelector('#image').src='/'+summary.revision+'/imagery/'+imagePath+'.webp';document.querySelector('#dem-caption').textContent={'fused':'SLDEM2015 avec raccord LOLA','lola':'LOLA seul','sldem2015':'SLDEM2015 seul','delta':'Différence SLDEM2015 − LOLA'}[variant];const blob=await fetch('/comparison/'+variant+'/'+path+'.png').then(r=>{if(!r.ok)throw Error('Échec de génération de la tuile');return r.blob()}),bitmap=await createImageBitmap(blob,{colorSpaceConversion:'none',premultiplyAlpha:'none'}),off=new OffscreenCanvas(257,257),c=off.getContext('2d');c.drawImage(bitmap,0,0);const raw=c.getImageData(0,0,257,257),output=new ImageData(257,257),maxAbs=Math.max(1,Math.abs(info.minHeight),Math.abs(info.maxHeight));for(let i=0;i<raw.data.length;i+=4){const h=256*raw.data[i]+raw.data[i+1]+raw.data[i+2]/256-32768;if(variant==='delta'){const t=Math.max(-1,Math.min(1,h/maxAbs));output.data[i]=t>0?255*Math.abs(t):0;output.data[i+1]=Math.round(255*(1-Math.abs(t)));output.data[i+2]=t<0?255*Math.abs(t):0}else{const g=Math.round(255*(h-info.minHeight)/Math.max(1,info.maxHeight-info.minHeight));output.data[i]=g;output.data[i+1]=g;output.data[i+2]=g}output.data[i+3]=raw.data[i+3]}document.querySelector('#dem').getContext('2d').putImageData(output,0,0);bitmap.close();document.querySelector('#tile-info').textContent=path+' · '+variant+' · '+info.minHeight.toFixed(2)+' à '+info.maxHeight.toFixed(2)+' m, 257 × 257 échantillons.'}
document.querySelector('#selection').addEventListener('submit',e=>{e.preventDefault();show().catch(e=>document.querySelector('#tile-info').textContent=e.message)});
async function poll(){try{const p=await fetch('/status.json').then(r=>r.json());document.querySelector('#status').textContent=p.phase==='complete'?'Génération terminée et contrôlée':p.phase==='failed'?'Génération interrompue : '+p.message:p.phase==='generate'?'Génération des tuiles':p.phase==='verify'?'Vérification des fichiers et des raccords':'Préparation des sources';document.querySelector('#progress').value=p.phase==='complete'?100:100*(p.completedFiles||0)/(p.targetFiles||1);document.querySelector('#details').textContent=(p.completedFiles||0)+' / '+(p.targetFiles||65532)+' fichiers'+(p.sharedBordersVerified?', '+p.sharedBordersVerified+' raccords vérifiés':'');if(p.phase==='complete'&&!summary){summary=await fetch('/summary.json').then(r=>r.json());document.querySelector('#ready').hidden=false;document.querySelector('#lod').max=summary.comparisonMaxLOD;document.querySelector('#details').textContent=summary.files+' fichiers, '+summary.sharedBordersVerified+' raccords vérifiés'+(summary.maxLOD>6?' · relief jusqu’au niveau '+summary.maxLOD:'');for(let face=0;face<6;face++){const f=document.createElement('figure'),im=document.createElement('img'),caption=document.createElement('figcaption');im.src='/'+summary.revision+'/imagery/'+face+'/0/0/0.webp';im.alt='Face '+face;caption.textContent='Face '+face;f.append(im,caption);document.querySelector('#faces').append(f)}document.querySelector('#face').value='0';document.querySelector('#lod').value='7';document.querySelector('#x').value='52';document.querySelector('#y').value='52';await show()}}catch(e){document.querySelector('#status').textContent=e.message}if(!summary)setTimeout(poll,3000)}poll();
</script></html>`;

/** Load only an explicitly completed inventory. An in-progress row is never client availability. */
export async function loadGlobalManifest(root: string): Promise<{ directory: string; manifest: IGlobalManifest }> {
    const pointer = JSON.parse(await readFile(storagePath(root, "catalog/latest-global.json"), "utf8")) as {
        directory: string;
        revision: string;
    };
    if (!/^[a-f0-9]{20}$/.test(pointer.revision) || pointer.directory !== `datasets/moon/global-${pointer.revision}`)
        throw new Error("Invalid global publication pointer");
    const manifest = JSON.parse(
        await readFile(storagePath(root, `${pointer.directory}/manifest.json`), "utf8"),
    ) as IGlobalManifest;
    if (
        manifest.schema !== "lunar-global/1" ||
        manifest.status !== "verified" ||
        manifest.revision !== pointer.revision
    )
        throw new Error("Invalid global publication");
    return { directory: pointer.directory, manifest };
}

/** Serve public-source global tiles on loopback, with CORS and stable revision URLs for engine tests. */
export function createGlobalServer(root: string): Server {
    let publication: Awaited<ReturnType<typeof loadGlobalManifest>> | undefined;
    let files: Map<string, IGlobalFile> | undefined;
    const server = createServer(async (request, response) => {
        response.setHeader("Access-Control-Allow-Origin", "*");
        response.setHeader("X-Content-Type-Options", "nosniff");
        response.setHeader("Cache-Control", "no-store");
        if (request.method !== "GET" && request.method !== "HEAD") {
            response.writeHead(405, { Allow: "GET, HEAD" }).end();
            return;
        }
        const path = request.url?.split("?")[0] ?? "/";
        try {
            let bytes: Buffer;
            if (path === "/") {
                bytes = Buffer.from(PAGE);
                response.setHeader("Content-Type", "text/html; charset=utf-8");
            } else if (path === "/status.json") {
                try {
                    bytes = await readFile(storagePath(root, "reports/global-progress.json"));
                } catch (error) {
                    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
                    bytes = Buffer.from(JSON.stringify({ phase: "pending" }));
                }
                response.setHeader("Content-Type", "application/json");
            } else {
                if (!publication) {
                    publication = await loadGlobalManifest(root);
                    files = new Map(
                        publication.manifest.files.map((file) => [
                            `/${publication!.manifest.revision}/${file.path}`,
                            file,
                        ]),
                    );
                }
                const { manifest, directory } = publication;
                response.setHeader("Content-Type", "application/json");
                if (path === "/summary.json")
                    bytes = Buffer.from(
                        JSON.stringify({
                            revision: manifest.revision,
                            comparisonMaxLOD: 11,
                            maxLOD: manifest.refinements?.reduce((lod, refinement) => Math.max(lod, refinement.maxLOD), manifest.maxLOD) ?? manifest.maxLOD,
                            globalMaxLOD: manifest.maxLOD,
                            imageryMaxLOD: manifest.maxLOD,
                            refinements: manifest.refinements ?? [],
                            frame: manifest.frame,
                            referenceRadii: manifest.referenceRadii,
                            files: manifest.files.length,
                            bytes: manifest.bytes,
                            sharedBordersVerified: manifest.sharedBordersVerified,
                        }),
                    );
                else if (path === "/manifest.json")
                    bytes = await readFile(storagePath(root, `${directory}/manifest.json`));
                else if (path === "/shackleton.json") bytes = await readFile(storagePath(root, `${directory}/shackleton.json`));
                else if (path === "/sources.json") bytes = Buffer.from(JSON.stringify(manifest.sources));
                else if (path === "/sldem2015.json") bytes = await readFile(storagePath(root, "catalog/sldem2015-sources.json"));
                else if (/^\/comparison-info\/(lola|sldem2015|fused|delta)\/\d\/\d+\/\d+\/\d+\.json$/.test(path)) {
                    const match = /^\/comparison-info\/(lola|sldem2015|fused|delta)\/(\d)\/(\d+)\/(\d+)\/(\d+)\.json$/.exec(path)!;
                    const tile = await comparisonTile(root, match[1] as MoonHeightVariant, {
                        face: Number(match[2]),
                        lod: Number(match[3]),
                        x: Number(match[4]),
                        y: Number(match[5]),
                    });
                    bytes = Buffer.from(JSON.stringify({ minHeight: tile.minHeight, maxHeight: tile.maxHeight, sha256: tile.sha256 }));
                } else if (/^\/comparison\/(lola|sldem2015|fused|delta)\/\d\/\d+\/\d+\/\d+\.png$/.test(path)) {
                    const match = /^\/comparison\/(lola|sldem2015|fused|delta)\/(\d)\/(\d+)\/(\d+)\/(\d+)\.png$/.exec(path)!;
                    const tile = await comparisonTile(root, match[1] as MoonHeightVariant, {
                        face: Number(match[2]),
                        lod: Number(match[3]),
                        x: Number(match[4]),
                        y: Number(match[5]),
                    });
                    response.setHeader("Content-Type", "image/png");
                    response.setHeader("ETag", `"${tile.sha256}"`);
                    response.setHeader("Cache-Control", "public, max-age=31536000, immutable");
                    if (request.headers["if-none-match"] === `"${tile.sha256}"`) {
                        response.writeHead(304).end();
                        return;
                    }
                    bytes = tile.bytes;
                }
                else if (path === "/height-ranges.json")
                    bytes = Buffer.from(
                        JSON.stringify(
                            Object.fromEntries(
                                manifest.files
                                    .filter((file) => file.kind === "elevation")
                                    .map((file) => [
                                        `${file.address.face}/${file.address.lod}/${file.address.x}/${file.address.y}`,
                                        [file.minHeight, file.maxHeight],
                                    ]),
                            ),
                        ),
                    );
                else if (path === "/elevation.json" || path === "/imagery.json") {
                    const descriptor = JSON.parse(await readFile(storagePath(root, `${directory}${path}`), "utf8")) as {
                        tiles: string;
                    };
                    const address = server.address();
                    if (!address || typeof address === "string") throw new Error("Server is not listening");
                    descriptor.tiles = `http://127.0.0.1:${address.port}/${manifest.revision}/${descriptor.tiles.replace(/^\.\//, "")}`;
                    bytes = Buffer.from(JSON.stringify(descriptor));
                } else if (/^\/tile-info\/\d\/\d+\/\d+\/\d+\.json$/.test(path)) {
                    const tile = files!.get(`/${manifest.revision}/elevation/${path.slice(11, -5)}.png`);
                    if (!tile) {
                        response.writeHead(404).end();
                        return;
                    }
                    bytes = Buffer.from(JSON.stringify(tile));
                } else {
                    const tile = files!.get(path);
                    if (!tile) {
                        response.writeHead(404).end();
                        return;
                    }
                    response.setHeader("ETag", `"${tile.sha256}"`);
                    response.setHeader("Cache-Control", "public, max-age=31536000, immutable");
                    if (request.headers["if-none-match"] === `"${tile.sha256}"`) {
                        response.writeHead(304).end();
                        return;
                    }
                    bytes = await readFile(storagePath(root, `${directory}/${tile.path}`));
                    if (bytes.length !== tile.bytes || sha256(bytes) !== tile.sha256)
                        throw new Error("Global tile integrity failed");
                    response.setHeader("Content-Type", tile.kind === "elevation" ? "image/png" : "image/webp");
                }
            }
            response.setHeader("Content-Length", bytes.length);
            response.writeHead(200).end(request.method === "HEAD" ? undefined : bytes);
        } catch (error) {
            response.setHeader("Cache-Control", "no-store");
            if ((error as NodeJS.ErrnoException).code === "ENOENT") {
                response.writeHead(503, { "Retry-After": "3" }).end();
            } else if (error instanceof RangeError) response.writeHead(416).end();
            else response.writeHead(500).end();
        }
    });
    return server;
}
