import { XMLBuilderCB } from "xmlbuilder2/lib/interfaces";
import { getXmlFieldMeta, getXmlName, IQName, toQualifiedString, Xml_Name, xmlNameToParts } from "./xml.interfaces";


type Primitive = string | number | boolean | bigint | Date;

function _isDate(x: any): x is Date {
  return x instanceof Date;
}

function _isPrimitive(x: any): x is Primitive {
  return (
    typeof x === "string" ||
    typeof x === "number" ||
    typeof x === "boolean" ||
    typeof x === "bigint" ||
    _isDate(x)
  );
}

export class XmlSerializer {
    
    _builder:XMLBuilderCB;
    _ns:Map<string,string> = new Map<string,string>();
    _prefixCount:number = 0;


    constructor(builder:XMLBuilderCB){
        if( !builder ) throw new Error("builder must be defined");
        this._builder = builder;
    }

    public withNamespace(...ns:Xml_Name[]) :  XmlSerializer{
        for(const s of ns){
           this._assignNamespace(s);
        }
        return this;
    }
    
    write(root:object, name?: Xml_Name) {
        this._builder.dec();
        
        name = name ?? getXmlName(root);
        if( !name ) throw new Error("can not find name for given object");
        let currentName:IQName = xmlNameToParts(name);
        if( currentName.ns ){
            // ensure we register the root namespace as default if not already set...
            this._assignNamespace(currentName.ns,"");
        }
        this._gatherNamespaces(root,new WeakSet<object>());
        const doc = this._builder.ele(currentName.ns??null, currentName.name);
        for(const pair of this._ns){
            doc.att(null,`xmlns:${pair[1]}`,pair[0]);
        }
        this._writeObjectContent(doc, root as Record<string,unknown>, new WeakSet<object>().add(root)) ;
    }


    private _writeObject(builder:XMLBuilderCB, source:object, visited:WeakSet<object>) : void
    {
       if( visited.has(source) ){
            return;
        }
        visited.add(source);

        if( Array.isArray(source))
        {
            for(const item of source){
                if (_isPrimitive(item)){
                    continue;
                }
                 this._writeObject(builder, item, visited);
            }
            return;
        }
        
        const qname = getXmlName(source);
        if( !qname ){
            return;
        }
        let currentName = xmlNameToParts(qname) ;
        let prefix= this._getPrefix(currentName) ;
        const tmp = toQualifiedString(currentName.name, prefix);
        builder.ele(null,tmp);
        this._writeObjectContent(builder,source as Record<string,unknown>,visited);
    }

    private _getPrefix(qn:IQName):string | undefined {
        if( qn.ns){
            return this._ns.get(qn.ns);
        }
        return undefined;
    }

    private _writeObjectContent(builder:XMLBuilderCB, source:Record<string,unknown>, visited:WeakSet<object>) : void
    {
       // gather meta and build index
        const metas = getXmlFieldMeta(source) ?? [];
        const metaByProp = new Map<string, typeof metas>();

        for (const m of metas) {
            const arr = metaByProp.get(m.prop) ?? [];
            arr.push(m);
            metaByProp.set(m.prop, arr);
        } 

        // We decide per property, using metadata if present
        for (const prop of Object.keys(source)) {
            const propMetas = metaByProp.get(prop);
            if(propMetas){
                const ignored = propMetas.some((m) => m.ignore === true || m.kind === "none");
                if (ignored) continue;

                for(const m of propMetas) {
                    if(m.name) {
                        switch( m.kind){
                            case "attr":{
                                const vStr = source[m.prop]?.toString();
                                if(vStr){
                                    let currentName = xmlNameToParts(m.name) ;
                                    let prefix= this._getPrefix(currentName) ;
                                    const tmp = toQualifiedString(currentName.name, prefix);
                                    builder.att(null,tmp,vStr);
                                }
                                break;
                            }
                        }
                    }
                }
                continue;
            }
            this._writeObject(builder,source, visited);
        }
    }

    // this is the first browse of the hierarchy to collect the namespaces and assign placeholder.( ns0, ns1,...)
    private _gatherNamespaces(tag:any, visited:WeakSet<object>) : void {

        if( visited.has(tag) ){
            return;
        }
        visited.add(tag);

        if( Array.isArray(tag))
        {
            for(const item of tag){
                if (_isPrimitive(item)){
                    continue;
                }
                 this._gatherNamespaces(item, visited);
            }
            return;
        }

        const qname = getXmlName(tag);
        if( qname) {
            this._assignNamespace(tag);
            return;
        }

        // gather meta and build index
        const metas = getXmlFieldMeta(tag) ?? [];
        const metaByProp = new Map<string, typeof metas>();

        for (const m of metas) {
            const arr = metaByProp.get(m.prop) ?? [];
            arr.push(m);
            metaByProp.set(m.prop, arr);
        } 


        // We decide per property, using metadata if present
        const toVisit : object[] = [];

        for (const prop of Object.keys(tag)) {

            const propMetas = metaByProp.get(prop);
            if(propMetas){
                const ignored = propMetas.some((m) => m.ignore === true || m.kind === "none");
                if (ignored) continue;

                for(const m of propMetas){
                    if(m.name) {
                        this._assignNamespace(m.name);
                    }
                }
            }
            toVisit.push(tag[prop]);
        }

        for(const v of toVisit){
            if (_isPrimitive(v)){
                continue;
            }
            this._gatherNamespaces(v,visited);
        }
    }

    private _assignNamespace(qn:Xml_Name, prefix?:string){
        const nqn = xmlNameToParts(qn);
        if(nqn?.ns){
            if(!this._ns.get(nqn.ns)){
                this._ns.set(nqn.ns, prefix ?? this._buildNsPrefix(nqn.ns));
            }
        }
    }

    private _buildNsPrefix(ns:string):string {
        let alreadyReferenced = false;
        let value:string;
        do{
            value = `ns${this._prefixCount++}`;
            for (const v of this._ns.values()) {
                if (v === value) {
                    alreadyReferenced = true;
                    break;
                }
            }
        } while(alreadyReferenced);

        return value;
    }
}