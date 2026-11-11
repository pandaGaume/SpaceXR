import { Mesh } from "@babylonjs/core/Meshes/mesh.js";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData.js";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial.js";
import { Color3 } from "@babylonjs/core/Maths/math.color.js";
import type { Scene } from "@babylonjs/core/scene.js";
import { EARTH_SYSTEM } from "./earth-model";

/** Static sea-level polar placeholders beyond Mercator coverage, without a second LOD system. */
export function createPolarCaps(scene:Scene):{dispose():void} {
    const meshes:Mesh[]=[];
    const material=new StandardMaterial("earth-polar-placeholder",scene);
    material.diffuseColor=new Color3(0.8,0.86,0.9);material.specularColor=Color3.Black();material.backFaceCulling=false;
    for(const sign of [-1,1]) {
        const positions:number[]=[],normals:number[]=[],indices:number[]=[];
        const edge=Math.atan(Math.sinh(Math.PI));
        for(let row=0;row<=4;row++) for(let col=0;col<=64;col++) {
            const latitude=sign*(edge+(Math.PI/2-edge)*row/4),longitude=col/64*2*Math.PI-Math.PI;
            const p=EARTH_SYSTEM.geodeticRadiansToEcef(latitude,longitude,0);
            const n=EARTH_SYSTEM.geodeticSurfaceNormalRadians(latitude,longitude);
            positions.push(p.x,p.y,p.z);normals.push(n.x,n.y,n.z);
        }
        for(let row=0;row<4;row++) for(let col=0;col<64;col++) {
            const a=row*65+col,b=a+1,c=a+65,d=c+1;
            if(sign===1) indices.push(a,b,c,b,d,c);else indices.push(a,c,b,b,c,d);
        }
        const mesh=new Mesh(`earth-polar-cap-${sign}`,scene);
        const data=new VertexData();data.positions=positions;data.normals=normals;data.indices=indices;data.applyToMesh(mesh);
        mesh.material=material;meshes.push(mesh);
    }
    return {dispose(){for(const mesh of meshes)mesh.dispose();material.dispose();}};
}
