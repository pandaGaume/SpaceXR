import { IVerticesData } from "../../geometry";
import { FloatArray, IndicesArray } from "../../types";
import { ThreeMFBuild, ThreeMFItem, ThreeMFMesh, ThreeMFMeta, ThreeMFModel, ThreeMFObject, ThreeMFResources, ThreeMFTriangle, ThreeMFTriangles, ThreeMFVertex, ThreeMFVertices } from "./3mf";
import { I3MFMesh, I3MFMetadata, I3MFObject, I3MFTriangle, I3MFTriangles, I3MFVertex, I3MFVertices, ST_ObjectType, ST_ResourceID, ST_Unit } from "./3mf.interfaces";
import { Matrix3D } from "./3mf.matrix";


export type vertexHandler = (vertex:I3MFVertex)=>I3MFVertex ;
export type triangleHandler = (triangle:I3MFTriangle)=>I3MFTriangle ;


export class ThreeMFMeshObjectBuilder {
    
    _vh?:vertexHandler;
    _th?:triangleHandler;

    _object : ThreeMFObject ;

    public constructor(id:ST_ResourceID, type:ST_ObjectType = ST_ObjectType.model){
        this._object = new ThreeMFObject(id,type);
    }

    public withPostProcessHandlers(vertex:vertexHandler, triangle:triangleHandler): ThreeMFMeshObjectBuilder {
        this._vh = vertex;
        this._th = triangle;
        return this;
    }

    withData(data:IVerticesData):ThreeMFMeshObjectBuilder{
        this._object.content = this._buildMesh(data);
        return this;
    }

    public build():I3MFObject {
        return this._object;
    }

    public reset(id:ST_ResourceID, type:ST_ObjectType){
        this._object = new ThreeMFObject(id,type);
    }


    private _buildMesh(data:IVerticesData) : I3MFMesh {
        if( !data.positions ){
            throw new Error("Invalid state: every mesh MUST define vertices.")
        }
        if( !data.indices ){
            throw new Error("Invalid state: every mesh MUST define triangles.")
        }
        const vertices = this._buildVertices(data.positions);
        const triangles = this._buildTriangle(data.indices);
        return new ThreeMFMesh(vertices,triangles);
    }

    private _buildVertices(p:FloatArray) : I3MFVertices {
        const container = new ThreeMFVertices();
        for(let i=0; i < p.length;){
            const x = p[i++];
            const y = p[i++];
            const z = p[i++];
            let v = new ThreeMFVertex(x,y,z);
            // might be optimized....
            if( this._vh){
                v = this._vh(v);
            }
            container.vertex.push(v);
        }
        return container;
    }

    private _buildTriangle(indice:IndicesArray) : I3MFTriangles {
        const container = new ThreeMFTriangles();
        for(let i=0; i < indice.length;){
            const a = indice[i++];
            const b = indice[i++];
            const c = indice[i++];
            let t = new ThreeMFTriangle(a,b,c);
            // might be optimized....
            if( this._th){
                t = this._th(t);
            }
            container.triangle.push(t);
        }
        return container;
    }
}


export class ThreeMFModelBuilder {
    
    static knownMetaSet = new Set(ThreeMFModel.KnownMeta.map(m => m.toLowerCase()));
    
    _model:ThreeMFModel  = new ThreeMFModel();
    _objects = new Map<string, I3MFObject>();

    public withMetaData(name:string, value:string, preserve?:boolean, type?:string) : ThreeMFModelBuilder {
        if( !this._model.metadata){
            // lazzy
            this._model.metadata = new Array<I3MFMetadata>();
        }
        //const isKnownMeta = (s: string): boolean => TMFBuilder.knownMetaSet.has(s.toLowerCase());
        //const qn:IQName = xmlNameToParts(name);
        this._model.metadata.push(new ThreeMFMeta(name,value,preserve,type));
        return this;
    }

    public withMesh(object: I3MFObject | ThreeMFMeshObjectBuilder ) : ThreeMFModelBuilder {
        if( object instanceof ThreeMFMeshObjectBuilder){
            object = object.build();
        }
        this._model.resources = this._model.resources??new ThreeMFResources();
        this._model.resources.object.push(object);
        return this;
    }

    public withBuild(objectid: ST_ResourceID, transform?: Matrix3D, partnumber?: string) : ThreeMFModelBuilder{
        this._model.build = this._model.build??new ThreeMFBuild();
        this._model.build.item?.push( new ThreeMFItem(objectid,transform,partnumber));
        return this;

    }

    public withUnit(unit:ST_Unit):ThreeMFModelBuilder{
        this._model.unit = unit;
        return this; 
    }

    public reset():ThreeMFModelBuilder{
        this._model = new ThreeMFModel();
        this._objects = new Map<string, I3MFObject>();
        return this;
    }

    public build():ThreeMFModel{
        // quick surface check..
        if (!this._model.resources?.object?.length){
            throw new Error("Invalid state: resources MUST be defined ");
        }
        if (!this._model.build?.item?.length) {
            throw new Error("Invalid state: Build MUST be defined ");
        }
        return this._model;
    }
}