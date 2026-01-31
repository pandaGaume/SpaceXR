
export interface IQName {
    ns?:string; 
    name:string;
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


export function xmlNameToParts(qn:Xml_Name):IQName{
      if(isQName(qn) ){
          return qn;
      } else {
          const parts = qn?.split(':')??[];
          if( parts.length == 2){
            return { ns:parts[0], name :parts[1]};
          }
          return { name:parts[0]} ;
      }
}

export function toQualifiedString(name:string, prefix?:string){
  return prefix ? `${prefix}:${name}` : name;
}
