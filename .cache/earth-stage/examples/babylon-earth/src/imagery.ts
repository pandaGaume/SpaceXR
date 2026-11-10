import { createRasterGrid } from "@spacexr/raster";
import type { IBabylonRasterPagesOptions } from "@spacexr/3d-tiles-babylon";

/** Offline demonstration: reproject the bundled visual map into requested Mercator tiles. */
export async function demoImagery():Promise<IBabylonRasterPagesOptions> {
    const image=new Image();image.src="/textures/earth_map.jpg";await image.decode();
    const canvas=document.createElement("canvas");canvas.width=image.width;canvas.height=image.height;
    const context=canvas.getContext("2d",{willReadFrequently:true});
    if(!context) throw new Error("Canvas image decoding is unavailable.");
    context.drawImage(image,0,0);
    const source=context.getImageData(0,0,image.width,image.height);
    const tileSize=128;
    return {tileSize,registration:"area",maxLOD:16,wrapX:true,cacheEntries:256,initialLayers:16,
        load:async(address,signal)=>{
            signal?.throwIfAborted();
            const data=new Uint8Array(tileSize*tileSize*4),scale=2**address.lod;
            for(let y=0;y<tileSize;y++) {
                const mercator=(address.y+(y+0.5)/tileSize)/scale;
                const latitude=Math.atan(Math.sinh(Math.PI*(1-2*mercator)));
                const sy=Math.min(image.height-1,Math.max(0,Math.floor((0.5-latitude/Math.PI)*image.height)));
                for(let x=0;x<tileSize;x++) {
                    const sx=Math.floor(((address.x+(x+0.5)/tileSize)/scale)*image.width)%image.width;
                    const from=(sy*image.width+sx)*4,to=(y*tileSize+x)*4;
                    data[to]=source.data[from]!;data[to+1]=source.data[from+1]!;data[to+2]=source.data[from+2]!;data[to+3]=255;
                }
            }
            return createRasterGrid(tileSize,tileSize,4,data);
        },
    };
}
