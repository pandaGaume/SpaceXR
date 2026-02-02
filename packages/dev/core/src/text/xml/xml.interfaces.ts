import { Nullable } from "../../types";

export interface IQName {
    ns?:string; 
    name:string;
}

export interface IXMLBuilder{
  dec(version:string, encoding?:string, standalone?:boolean):IXMLBuilder;
  att(ns:Nullable<string>, n:string, v:string): IXMLBuilder;
  ele(ns:Nullable<string>, n:string): IXMLBuilder;
  text(txt:string): IXMLBuilder;
  end(): IXMLBuilder;
}

export function isQName(x: unknown): x is { name: string } {
  return typeof (x as any)?.name === "string";
}

export type Xml_Name = string | IQName;

type FieldKind = "attr" | "elem" | "none";

type FieldMeta = {
  kind: FieldKind;
  prop: string;
  name?:Xml_Name;
  ignore?:boolean;
};

const XML_CLASS_META = Symbol("__xml:meta$__");
const XML_CLASS_NAME = Symbol("__xml:name$__");

function addMeta(target: any, meta: FieldMeta) {
  const ctor = target.constructor;
  (ctor[XML_CLASS_META] ??= []).push(meta);
}


export function XmlName(name: Xml_Name) {
  return (ctor: Function) => {
    (ctor as any)[XML_CLASS_NAME] = name;
  };
}

// tell the serializer to ignore the property
export function XmlIgnore() {
  return (target: any, prop: string) => addMeta(target, { kind: "none", prop, ignore:true } ) ;
}

// tell the serializer to serialize the property as attribute
export function XmlAttr(opts?:{name:Xml_Name} ) {
  return (target: any, prop: string) => addMeta(target, { kind: "attr", prop, ...opts });
}

// tell the serializer to serialize the property as element - this is the default behavior but shoud be 
// specified when wanted to update the default name of the classe or if the class is not decorated (without @XmlName)
export function XmlElem(opts?: {name:Xml_Name}) {
  return (target: any, prop: string) => addMeta(target, { kind: "elem", prop, ...opts });
}

export function getXmlFieldMeta(obj: any): FieldMeta[] {
  return (obj?.constructor?.[XML_CLASS_META] ?? []) as FieldMeta[];
}

export function getXmlName(obj: any): Xml_Name | undefined {
  const n = obj?.constructor?.[XML_CLASS_NAME] ;
  return n? n  as Xml_Name : undefined;
}


function looksLikeXmlNCName(s: string): boolean {
  // Approximation ASCII de NCName: pas de ":" et demarre par lettre ou underscore
  // Puis lettres/chiffres/underscore/point/tiret.
  return /^[A-Za-z_][A-Za-z0-9._-]*$/.test(s);
}

export function xmlNameToParts(qn: Xml_Name): IQName {
  if (isQName(qn)) return qn;

  const s = (qn ?? "").trim();
  if (!s) return { name: "" };

  const i = s.indexOf(":");
  if (i === -1) {
    return { name: s };
  }

  // Un QName XML ne doit contenir qu un seul ":".
  // Si il y en a plusieurs, on considere que ce n est pas un QName.
  if (s.indexOf(":", i + 1) !== -1) {
    return { name: s };
  }

  const prefix = s.slice(0, i);
  const local = s.slice(i + 1);

  if (looksLikeXmlNCName(prefix) && looksLikeXmlNCName(local)) {
    return { ns: prefix, name: local };
  }

  return { name: s };
}


export function toQualifiedString(name:string, prefix?:string){
  return prefix ? `${prefix}:${name}` : name;
}
