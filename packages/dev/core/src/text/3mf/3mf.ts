import { Nullable } from "../../types";
import { IQName, XmlAttr, XmlName } from "../xml/xml.interfaces";
import { I3MFBuild, I3MFBuildItem, I3MFMetadata, I3MFModel, I3MFObject, I3MFResources, ST_Unit } from "./3mf.interfaces";

export const TDModelNS = "http://schemas.microsoft.com/3dmanufacturing/core/2015/02"
export const TriangleSetsNS = "http://schemas.microsoft.com/3dmanufacturing/trianglesets/2021/07"

@XmlName({ns:TDModelNS, name:"model"})
export class TMFModel implements I3MFModel {

    public static KnownMeta:Array<string> = ["Title","Designer","Description","Copyright","LicenseTerms","Rating","CreationDate","ModificationDate","Application"]

    @XmlAttr({name:"unit"})
    unit: ST_Unit = ST_Unit.millimeter;

    @XmlAttr({name:"requiredextensions"})
    requiredExtensions?: Nullable<string>;

    @XmlAttr({name:"recommendedextensions"})
    recommendedExtensions?: Nullable<string> ;

    metadata?: Nullable<I3MFMetadata[]> ;
    resources?:  Nullable<I3MFResources>;
    build?:  Nullable<I3MFBuild>;
}

@XmlName("meta")
export class TFMeta implements I3MFMetadata {

    @XmlAttr({name:"name"})
    name: string;
    
    @XmlAttr({name:"preserve"})
    preserve?: boolean ;
    
    @XmlAttr({name:"type"})
    type?: IQName ;
    
    value: any;

    public constructor(name:string, value:any){
        this.name = name;
        this.value = value;
    }
}

@XmlName("ressources")
export class T3MFResources implements I3MFResources{

    @XmlAttr({name:"id"})
    id: string;

    childs?: Nullable<I3MFObject[]>

    public constructor(id:string){
        this.id = id;
    }
} 

@XmlName("build")
export class T3MBuild implements I3MFBuild {
    childs?: Nullable<I3MFBuildItem[]>
} 
