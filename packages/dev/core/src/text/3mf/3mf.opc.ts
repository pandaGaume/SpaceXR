
import { XmlAttr, XmlName } from "../xml/xml.interfaces";

export const TDContentTypesNS = "http://schemas.openxmlformats.org/package/2006/content-types"
export const TDRelationshipsNS = "http://schemas.openxmlformats.org/package/2006/relationships"

export enum KnownThreeMFContentType {
  // OPC core
  Relationships = "application/vnd.openxmlformats-package.relationships+xml",

  // 3MF core
  Model = "application/vnd.ms-package.3dmanufacturing-3dmodel+xml",

  // Extensions officielles
  Materials = "application/vnd.ms-package.3dmanufacturing-material+xml",
  Colors = "application/vnd.ms-package.3dmanufacturing-colors+xml",
  Texture = "application/vnd.ms-package.3dmanufacturing-texture+xml",
  Texture2D = "application/vnd.ms-package.3dmanufacturing-texture2d+xml",
  Production = "application/vnd.ms-package.3dmanufacturing-production+xml",
  Slice = "application/vnd.ms-package.3dmanufacturing-slice+xml",
  BeamLattice = "application/vnd.ms-package.3dmanufacturing-beamlattice+xml",
  SecureContent = "application/vnd.ms-package.3dmanufacturing-securecontent+xml",

  // Assets
  Png = "image/png",
  Jpeg = "image/jpeg",
  Tiff = "image/tiff",
  Xml = "application/xml",
}

export const RelationshipDirName = "_rels/"
export const Object3dDirName = "3D/"
export const ModelFileName = `3dmodel.model`
export const RelationshipFileName = `.rels`
export const ContentTypeFileName = "[Content_Types].xml"

@XmlName({ns:TDContentTypesNS,name:"Types"})
export class ThreeMFContentTypes{
    items:ThreeMFContentType[] = [];
}

// Common OPC and 3MF relationship Type URIs.
//
// Notes:
// - Relationship "Type" is always a URI, not a short label like "model".
// - There is no closed list. Unknown/custom URIs are allowed by OPC and may appear in real files.
// - Most slicers only care about the 3D model relationship and ignore the rest.

export class ThreeMFRelationshipTypes {
  // 3MF core: points to the main .model part of the package
  public static readonly ThreeDModel =
    "http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel";

  // OPC core: points to a package thumbnail (often used by 3MF packages)
  public static readonly Thumbnail =
    "http://schemas.openxmlformats.org/package/2006/relationships/metadata/thumbnail";

  // 3MF (print ticket): optional printing settings part (rarely used by slicers)
  public static readonly PrintTicket =
    "http://schemas.microsoft.com/3dmanufacturing/2013/01/printticket";

  // OPC core: indicates parts that must be preserved when editing the package
  public static readonly MustPreserve =
    "http://schemas.openxmlformats.org/package/2006/relationships/mustpreserve";

  // Convenience set for quick checks
  public static readonly Known: ReadonlySet<string> = new Set<string>([
    ThreeMFRelationshipTypes.ThreeDModel,
    ThreeMFRelationshipTypes.Thumbnail,
    ThreeMFRelationshipTypes.PrintTicket,
    ThreeMFRelationshipTypes.MustPreserve,
  ]);

  // Returns true if the relationship Type is one of the common known URIs above
  public static isKnown(type: string): boolean {
    return ThreeMFRelationshipTypes.Known.has(type);
  }

  // Returns true if the relationship Type is the main 3MF model entry point
  public static isThreeDModel(type: string): boolean {
    return type === ThreeMFRelationshipTypes.ThreeDModel;
  }
}

@XmlName({ns:TDContentTypesNS,name:"Default"})
export class ThreeMFContentType {
    @XmlAttr({ name: {ns:TDContentTypesNS, name:"Extension" }})
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
    id:string;

    @XmlAttr({name:"Type"})
    type?:String;

    @XmlAttr({name:"Target"})
    target?:string;

    constructor(id:string, type:string,target:string){
        this.id = id;
        this.type = type;
        this.target = target;
    }
}