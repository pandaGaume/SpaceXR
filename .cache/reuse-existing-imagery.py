from pathlib import Path
r=Path('C:/Users/GuillaumePelletier/Documents/GitHub/Gaume/spacexr-rendering')
p=r/'examples/babylon-earth/src/main.ts';s=p.read_text(encoding='utf-8').replace('import { demoImagery } from "./imagery";', 'import { loadLocalImagery } from "../../babylon-implicit-grid-mapzen/src/local-imagery";')
s=s.replace('        const imagery = inside ? undefined : await demoImagery();','''        const imageryName = query.get("imagery") ?? "google";
        const imagerySource = imageryName === "none" ? undefined : await loadLocalImagery(imageryName);
        const imagery = imagerySource ? {
            load: imagerySource.load,
            registration: imagerySource.registration,
            maxLOD: imagerySource.maxLOD,
            tileSize: TERRAIN_CONFIG.imagery.tileCells,
            wrapX: true,
            cacheEntries: TERRAIN_CONFIG.imagery.contentCacheEntries,
        } : undefined;''')
a=s.index('        element<HTMLElement>("attribution").textContent =');b=s.index('        let stopped =',a)
s=s[:a]+'''        element<HTMLElement>("attribution").textContent = [
            demEnabled ? "Relief Mapzen Terrain Tiles (Terrarium), AWS Open Data. Normales issues du DEM." : "Surface ellipsoïdale.",
            imagerySource?.attribution,
        ].filter(Boolean).join(" | ");
'''+s[b:];p.write_text(s,encoding='utf-8')
(r/'examples/babylon-earth/src/imagery.ts').unlink()
