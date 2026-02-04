import { Nullable } from "../../types";
import { IQName, XmlAttr, XmlName } from "../xml/xml.interfaces";

import {
  I3MFBase,
  I3MFBaseMaterials,
  I3MFBuild,
  I3MFComponent,
  I3MFComponents,
  I3MFItem,
  I3MFMesh,
  I3MFMetadata,
  I3MFMetadataGroup,
  I3MFModel,
  I3MFObject,
  I3MFResources,
  I3MFTriangle,
  I3MFTriangles,
  I3MFVertex,
  I3MFVertices,
  Matrix3D,
  ST_ColorValue,
  ST_Number,
  ST_ObjectType,
  ST_ResourceID,
  ST_ResourceIndex,
  ST_UriReference,
  ST_Unit
} from "./3mf.interfaces";

export const TDModelNS = "http://schemas.microsoft.com/3dmanufacturing/core/2015/02";
export const TriangleSetsNS = "http://schemas.microsoft.com/3dmanufacturing/trianglesets/2021/07";

@XmlName({ ns: TDModelNS, name: "model" })
export class ThreeMFModel implements I3MFModel {
  public static KnownMeta: Array<string> = [
    "Title",
    "Designer",
    "Description",
    "Copyright",
    "LicenseTerms",
    "Rating",
    "CreationDate",
    "ModificationDate",
    "Application"
  ];

  @XmlAttr({ name: "unit" })
  unit: ST_Unit = ST_Unit.millimeter;

  @XmlAttr({ name: "requiredextensions" })
  requiredextensions?: string;

  @XmlAttr({ name: "recommendedextensions" })
  recommendedextensions?: string;

  metadata?: Nullable<Array<I3MFMetadata>> = null;
  resources?: Nullable<I3MFResources> = null;
  build?: Nullable<I3MFBuild> = null;
}

@XmlName({ ns: TDModelNS, name: "meta" })
export class ThreeMFMeta implements I3MFMetadata {
  @XmlAttr({ name: "name" })
  name: IQName;

  @XmlAttr({ name: "preserve" })
  preserve?: boolean;

  @XmlAttr({ name: "type" })
  type?: string;

  value: string;

  public constructor(name: IQName, value: string, preserve?: boolean, type?: string) {
    this.name = name;
    this.value = value;
    this.preserve = preserve;
    this.type = type;
  }
}

@XmlName({ ns: TDModelNS, name: "metadatagroup" })
export class ThreeMFMetadataGroup implements I3MFMetadataGroup {
  metadata: Array<I3MFMetadata> = [];
}

@XmlName({ ns: TDModelNS, name: "resources" })
export class ThreeMFResources implements I3MFResources {
  object: Array<I3MFObject> = [];
  basematerials?: Array<I3MFBaseMaterials>;
}

@XmlName({ ns: TDModelNS, name: "object" })
export class ThreeMFObject implements I3MFObject {
  @XmlAttr({ name: "id" })
  id: ST_ResourceID;

  @XmlAttr({ name: "type" })
  type?: ST_ObjectType;

  @XmlAttr({ name: "thumbnail" })
  thumbnail?: ST_UriReference;

  @XmlAttr({ name: "partnumber" })
  partnumber?: string;

  @XmlAttr({ name: "name" })
  name?: string;

  @XmlAttr({ name: "pid" })
  pid?: ST_ResourceID;

  @XmlAttr({ name: "pindex" })
  pindex?: ST_ResourceIndex;

  metadatagroup?: I3MFMetadataGroup;

  content?: I3MFMesh | I3MFComponents;

  public constructor(id: ST_ResourceID) {
    this.id = id;
  }
}

@XmlName({ ns: TDModelNS, name: "mesh" })
export class ThreeMFMesh implements I3MFMesh {
  vertices: I3MFVertices;
  triangles: I3MFTriangles;

  public constructor(vertices?: I3MFVertices, triangles?: I3MFTriangles) {
    this.vertices = vertices ?? new ThreeMFVertices();
    this.triangles = triangles ?? new ThreeMFTriangles();
  }
}

@XmlName({ ns: TDModelNS, name: "vertices" })
export class ThreeMFVertices implements I3MFVertices {
  vertex: Array<I3MFVertex> = [];
}

@XmlName({ ns: TDModelNS, name: "vertex" })
export class ThreeMFVertex implements I3MFVertex {
  @XmlAttr({ name: "x" })
  x: ST_Number;

  @XmlAttr({ name: "y" })
  y: ST_Number;

  @XmlAttr({ name: "z" })
  z: ST_Number;

  public constructor(x: ST_Number = 0, y: ST_Number = 0, z: ST_Number = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
}

@XmlName({ ns: TDModelNS, name: "triangles" })
export class ThreeMFTriangles implements I3MFTriangles {
  triangle: Array<I3MFTriangle> = [];
}

@XmlName({ ns: TDModelNS, name: "triangle" })
export class ThreeMFTriangle implements I3MFTriangle {
  @XmlAttr({ name: "v1" })
  v1: ST_ResourceIndex;

  @XmlAttr({ name: "v2" })
  v2: ST_ResourceIndex;

  @XmlAttr({ name: "v3" })
  v3: ST_ResourceIndex;

  @XmlAttr({ name: "p1" })
  p1?: ST_ResourceIndex;

  @XmlAttr({ name: "p2" })
  p2?: ST_ResourceIndex;

  @XmlAttr({ name: "p3" })
  p3?: ST_ResourceIndex;

  @XmlAttr({ name: "pid" })
  pid?: ST_ResourceID;

  public constructor(v1: ST_ResourceIndex, v2: ST_ResourceIndex, v3: ST_ResourceIndex) {
    this.v1 = v1;
    this.v2 = v2;
    this.v3 = v3;
  }
}

@XmlName({ ns: TDModelNS, name: "components" })
export class ThreeMFComponents implements I3MFComponents {
  component: Array<I3MFComponent> = [];
}

@XmlName({ ns: TDModelNS, name: "component" })
export class ThreeMFComponent implements I3MFComponent {
  @XmlAttr({ name: "objectid" })
  objectid: ST_ResourceID;

  @XmlAttr({ name: "transform" })
  transform?: Matrix3D;

  public constructor(objectid: ST_ResourceID, transform?: Matrix3D) {
    this.objectid = objectid;
    this.transform = transform;
  }
}

@XmlName({ ns: TDModelNS, name: "basematerials" })
export class ThreeMFBaseMaterials implements I3MFBaseMaterials {
  @XmlAttr({ name: "id" })
  id: ST_ResourceID;

  base: Array<I3MFBase> = [];

  public constructor(id: ST_ResourceID) {
    this.id = id;
  }
}

@XmlName({ ns: TDModelNS, name: "base" })
export class ThreeMFBase implements I3MFBase {
  @XmlAttr({ name: "name" })
  name: string;

  @XmlAttr({ name: "displaycolor" })
  displaycolor: ST_ColorValue;

  public constructor(name: string, displaycolor: ST_ColorValue) {
    this.name = name;
    this.displaycolor = displaycolor;
  }
}

@XmlName({ ns: TDModelNS, name: "build" })
export class ThreeMFBuild implements I3MFBuild {
  item?: Nullable<Array<I3MFItem>>;
}

@XmlName({ ns: TDModelNS, name: "item" })
export class ThreeMFItem implements I3MFItem {
  @XmlAttr({ name: "objectid" })
  objectid: ST_ResourceID;

  @XmlAttr({ name: "transform" })
  transform?: Matrix3D;

  @XmlAttr({ name: "partnumber" })
  partnumber?: string;

  metadatagroup?: I3MFMetadataGroup;

  public constructor(objectid: ST_ResourceID, transform?: Matrix3D, partnumber?: string) {
    this.objectid = objectid;
    this.transform = transform;
    this.partnumber = partnumber;
  }
}
