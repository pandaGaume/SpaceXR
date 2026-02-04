import { IVerticesData } from "../../geometry";
import { FloatArray, IndicesArray } from "../../types";
import { IQName } from "../xml";
import { ThreeMFMesh, ThreeMFMeta, ThreeMFModel, ThreeMFObject, ThreeMFResources, ThreeMFTriangle, ThreeMFTriangles, ThreeMFVertex, ThreeMFVertices } from "./3mf";
import { I3MFMesh, I3MFMetadata, I3MFObject, I3MFTriangle, I3MFTriangles, I3MFVertex, I3MFVertices, ST_ResourceID, ST_Unit } from "./3mf.interfaces";


export type vertexHandler = (vertex:I3MFVertex)=>I3MFVertex ;
export type triangleHandler = (triangle:I3MFTriangle)=>I3MFTriangle ;

export interface  RessourceIdFactory {
    next():ST_ResourceID; 
    reset():RessourceIdFactory
}

export class IncrementalIdFactory{

    _from:number ;
    _to:number;
    _step:number ;

    _i:number;

    public constructor(from:number=0,to:number= Number.MIN_SAFE_INTEGER,step:number= 1){
        this._from = from;
        this._to = to;
        this._step = step;
        this._i = from;
    }

    public next():ST_ResourceID {
        if( this._i < this._to){
            throw new Error("ST_ResourceID out of bound") ;
        }
        const v = this._i;
        this._i += this._step;
        return v;
    }

    public reset():RessourceIdFactory{
        this._i = this._from;
        return this;
    }
}


export class TMFBuilder {
    
    static knownMetaSet = new Set(ThreeMFModel.KnownMeta.map(m => m.toLowerCase()));
    
    _model:ThreeMFModel  = new ThreeMFModel();
    _datas:Array<IVerticesData> = new Array<IVerticesData>();
    _vh?:vertexHandler;
    _th?:triangleHandler;
    _idf?:RessourceIdFactory;
    _defaultIdf = new IncrementalIdFactory();
  
    public withPostProcessHandlers(vertex:vertexHandler, triangle:triangleHandler): TMFBuilder {
        this._vh = vertex;
        this._th = triangle;
        return this;
    }

    public withIdFactory(f:RessourceIdFactory): TMFBuilder {
        this._idf = f;
        return this;
    }

    public withModelMetaData(ns: string | null, name:string, value:string, preserve?:boolean, type?:string) : TMFBuilder {
        if( !this._model.metadata){
            // lazzy
            this._model.metadata = new Array<I3MFMetadata>();
        }
        const isKnownMeta = (s: string): boolean => TMFBuilder.knownMetaSet.has(s.toLowerCase());
        if( !isKnownMeta && ns == null){
            throw new Error(`${name} is NOT a known meta from 3MF specification, you MUST provide a namespace.`)
        }

        const qn:IQName = ns ? {name:name} : {ns:ns!,name:name};
        this._model.metadata.push(new ThreeMFMeta(qn,value,preserve,type));
        return this;
    }

    public withVerticeData(... data:Array<IVerticesData>) : TMFBuilder {
        this._datas.push(... data);
        return this;
    }

    public withUnit(unit:ST_Unit):TMFBuilder{
        this._model.unit = unit;
        return this; 
    }

    public reset():TMFBuilder{
        this._model = new ThreeMFModel();
        this._datas = new Array<IVerticesData>();
        return this;
    }

    public build():ThreeMFModel | undefined{

        let ok = this._datas.length > 0 && this._datas.every(v => v != null);
        if (!ok) throw new Error("Invalid state: data must be correctly initialized.");
        if( !this._model.resources){
            this._model.resources = new ThreeMFResources();
        }
        // then build the object of ype mesh 
        const target = this._model.resources.object; // already created 
        for(const d of this._datas){
            const o = this._buildMeshObject(d);
            if(o) target.push(o); 
        }

        return this._model;
    }

    private _buildMeshObject(data:IVerticesData) : I3MFObject {
        const id = this._idf?.next() ?? this._defaultIdf.next();
        const o = new ThreeMFObject(id);
        o.content = this._buildMesh(data);
        return o;
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