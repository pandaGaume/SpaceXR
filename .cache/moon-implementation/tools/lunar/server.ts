import { createServer, type Server } from "node:http";
import { readFile } from "node:fs/promises";
import { sha256, storagePath } from "./storage";
import type { IPilotManifest } from "./pilot";

const PAGE = `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>Lune : pilote cubique</title><style>
body{margin:32px auto;padding:0 24px;max-width:1100px;background:#101827;color:#e6edf5;font:16px system-ui}
h1,h2{font-weight:550}p{line-height:1.6}section{background:#192538;padding:24px;margin:24px 0;border-radius:12px}
.faces{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}img{width:100%;image-rendering:auto}figure{margin:0}figcaption{font-size:14px;color:#b6cadf}
canvas{display:block;max-width:100%;height:auto;margin:auto}a{color:#8ec8ff}#status{color:#b6cadf}code{overflow-wrap:anywhere}
</style><h1>Lune : premier lot cubique</h1>
<p>Base globale LROC et relief LOLA. Le lot HD couvre environ 2,7 km autour du pôle Sud, sur le secteur du rebord de Shackleton. Il ne couvre pas encore tout le cratère.</p>
<p id="status">Lecture du manifeste...</p><section><h2>Relief polaire, grille source à 5 m</h2>
<p>Vue verticale de quatre tuiles cubiques. Les gris représentent la hauteur relative : sombre = plus bas, clair = plus haut. Ce panneau est un diagnostic du DEM, pas une photographie ni un rendu 3D.</p>
<canvas id="polar" width="513" height="513"></canvas><p id="range"></p></section>
<section><h2>Six faces de l'imagerie globale</h2><div class="faces" id="faces"></div></section>
<p><a href="/pilot.json">Inventaire et provenance</a> · <a href="/elevation.json">Descripteur relief global</a> · <a href="/imagery.json">Descripteur imagerie globale</a></p>
<p>Prévisualisation technique. La réalisation du référentiel et le zéro vertical du produit HD restent à confirmer avant publication scientifique. Les niveaux intermédiaires de la descente restent à produire.</p>
<script type="module">
const m=await fetch('/pilot.json').then(r=>{if(!r.ok)throw Error('Pilote absent');return r.json()});
document.querySelector('#status').textContent=m.tiles.length+' tuiles, '+m.sharedBordersVerified+' raccords HD vérifiés. Révision '+m.revision;
const url=t=>'/'+m.revision+'/'+t.path;
for(const t of m.tiles.filter(t=>t.kind==='global-imagery')){const f=document.createElement('figure'),i=document.createElement('img'),c=document.createElement('figcaption');i.src=url(t);i.alt='Face cubique '+t.address.face;c.textContent='Face '+t.address.face;f.append(i,c);document.querySelector('#faces').append(f)}
const tiles=m.tiles.filter(t=>t.kind==='polar-elevation'),lo=Math.min(...tiles.map(t=>t.minHeight)),hi=Math.max(...tiles.map(t=>t.maxHeight));
const canvas=document.querySelector('#polar'),ctx=canvas.getContext('2d'),output=ctx.createImageData(513,513);
for(const t of tiles){const blob=await fetch(url(t)).then(r=>r.blob()),bitmap=await createImageBitmap(blob,{colorSpaceConversion:'none',premultiplyAlpha:'none'}),off=new OffscreenCanvas(257,257),c=off.getContext('2d');c.drawImage(bitmap,0,0);const p=c.getImageData(0,0,257,257).data;
for(let y=0;y<257;y++)for(let x=0;x<257;x++){const k=(y*257+x)*4,h=256*p[k]+p[k+1]+p[k+2]/256-32768,g=Math.round(255*(h-lo)/Math.max(1,hi-lo)),j=((t.address.y-1023)*256*513+(t.address.x-1023)*256+y*513+x)*4;output.data[j]=g;output.data[j+1]=g;output.data[j+2]=g;output.data[j+3]=p[k+3]}bitmap.close()}
ctx.putImageData(output,0,0);document.querySelector('#range').textContent='Hauteurs sur la surface cible : '+lo.toFixed(2)+' à '+hi.toFixed(2)+' m. Pas cubique central : environ 5,2 m.';
</script></html>`;

/**
 * Serve only one completed pilot inventory, bound to loopback. A missing tile is 404.
 * Revision URLs and ETags identify exact bytes; metadata pointers are never cached.
 * No request path can select an arbitrary file on the attached disk.
 */
export async function createPilotServer(root: string): Promise<Server> {
    const latest = JSON.parse(await readFile(storagePath(root, "catalog/latest-pilot.json"), "utf8")) as { directory: string; revision: string };
    if (!/^[a-f0-9]{20}$/.test(latest.revision) || latest.directory !== `datasets/moon/pilot-${latest.revision}`)
        throw new Error("Invalid pilot pointer");
    const manifest = JSON.parse(await readFile(storagePath(root, `${latest.directory}/pilot.json`), "utf8")) as IPilotManifest;
    if (manifest.revision !== latest.revision || manifest.schema !== "lunar-pilot-result/1") throw new Error("Invalid pilot manifest");
    for (const tile of manifest.tiles) {
        const bytes = await readFile(storagePath(root, `${latest.directory}/${tile.path}`));
        if (bytes.length !== tile.bytes || sha256(bytes) !== tile.sha256) throw new Error("Pilot contains a corrupt tile");
    }
    const allowed = new Map(manifest.tiles.map(tile => [`/${manifest.revision}/${tile.path}`, tile]));
    const server = createServer(async (request, response) => {
        response.setHeader("Access-Control-Allow-Origin", "*");
        response.setHeader("X-Content-Type-Options", "nosniff");
        response.setHeader("Cache-Control", "no-store");
        if (request.method !== "GET" && request.method !== "HEAD") {
            response.writeHead(405, { Allow: "GET, HEAD" }).end(); return;
        }
        const path = request.url?.split("?")[0] ?? "/";
        try {
            let bytes: Buffer;
            if (path === "/") {
                bytes = Buffer.from(PAGE);
                response.setHeader("Content-Type", "text/html; charset=utf-8");
            } else if (path === "/pilot.json") {
                bytes = Buffer.from(JSON.stringify(manifest));
                response.setHeader("Content-Type", "application/json");
            } else if (path === "/elevation.json" || path === "/imagery.json") {
                const descriptor = JSON.parse(await readFile(storagePath(root, `${latest.directory}${path}`), "utf8")) as { tiles: string };
                // Match the fixed loopback endpoint. Host headers never enter a published URL.
                const address = server.address();
                if (!address || typeof address === "string") throw new Error("Server is not listening");
                descriptor.tiles = `http://127.0.0.1:${address.port}/${manifest.revision}/${descriptor.tiles.replace(/^\.\//, "")}`;
                bytes = Buffer.from(JSON.stringify(descriptor));
                response.setHeader("Content-Type", "application/json");
            } else {
                const tile = allowed.get(path);
                if (!tile) { response.writeHead(404).end(); return; }
                const etag = `"${tile.sha256}"`;
                response.setHeader("ETag", etag);
                response.setHeader("Cache-Control", "public, max-age=31536000, immutable");
                if (request.headers["if-none-match"] === etag) { response.writeHead(304).end(); return; }
                bytes = await readFile(storagePath(root, `${latest.directory}/${tile.path}`));
                response.setHeader("Content-Type", tile.kind === "global-imagery" ? "image/webp" : "image/png");
            }
            response.setHeader("Content-Length", bytes.length);
            response.writeHead(200);
            response.end(request.method === "HEAD" ? undefined : bytes);
        } catch (error) {
            const missing = (error as NodeJS.ErrnoException).code === "ENOENT";
            response.writeHead(missing ? 404 : 500).end();
        }
    });
    return server;
}
