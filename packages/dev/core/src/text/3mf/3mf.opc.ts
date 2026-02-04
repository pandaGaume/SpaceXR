
import { XmlAttr, XmlName } from "../xml/xml.interfaces";
import { ST_ResourceID } from "./3mf.interfaces";

export const TDContentTypesNS = "http://schemas.openxmlformats.org/package/2006/content-types"
export const TDRelationshipsNS = "http://schemas.openxmlformats.org/package/2006/relationships"

export const RelationshipDirName = "./_rels/"
export const Object3dDirName = "./3D/"
export const ModelFileName = `3dmodel.model`
export const RelationshipFileName = `.rel`
export const ContentTypeFileName = "[ContentType].xml"

@XmlName({ns:TDContentTypesNS,name:"Types"})
export class ThreeMFContentTypes{
    items:ThreeMFContentType[] = [];
}

@XmlName({ns:TDContentTypesNS,name:"Default"})
export class ThreeMFContentType {
    @XmlAttr({ name: {ns:TDContentTypesNS, name:"Extensions" }})
    ext:string;
    @XmlAttr({ name: {ns:TDContentTypesNS, name:"ContentType" }})
    ct:string;

    constructor(ext:string,ct:string){
        this.ext = ext;
        this.ct = ct;
    }
}

@XmlName({ns:TDRelationshipsNS,name:"Relationships"})
export class ThreeMFRelationships{
    items:ThreeMFRelationship[] = [];
}

@XmlName({ns:TDRelationshipsNS,name:"Relationship"})
export class ThreeMFRelationship{
    @XmlAttr({name:"Id"})
    id:ST_ResourceID;

    @XmlAttr({name:"Type"})
    type?:String;

    @XmlAttr({name:"Target"})
    target?:string;

    constructor(id:ST_ResourceID){
        this.id = id;
    }
}