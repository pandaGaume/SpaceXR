import { Zip, ZipDeflate } from "fflate";

import { ByteSink, Utf8XmlWriterToBytes } from "../xml/xml.builder.bytes";
import { ContentTypeFileName, KnownThreeMFContentType, ModelFileName, Object3dDirName, RelationshipDirName, RelationshipFileName, ThreeMFContentType, ThreeMFContentTypes, ThreeMFRelationship, ThreeMFRelationships, ThreeMFRelationshipTypes } from "./3mf.opc";
import { ThreeMFModel } from "./3mf";
import { ThreeMFModelBuilder } from "./3mf.builder";
import { XmlBuilder, XmlSerializer } from "../xml";

export class OrderedFileSink implements ByteSink {
  private _p: Promise<void> = Promise.resolve();
  private _closed = false;

  constructor(private readonly writer: WritableStreamDefaultWriter<Uint8Array>) {}

  push(chunk: Uint8Array, final?: boolean): void {
    if (this._closed) return;

    this._p = this._p.then(async () => {
      if (chunk.length) await this.writer.write(chunk);
      if (final) {
        this._closed = true;
        await this.writer.close();
      }
    });
  }

  done(): Promise<void> {
    return this._p;
  }
}

export async function createZipToFile(fileHandle: FileSystemFileHandle) {
  const fileWritable = await fileHandle.createWritable();
  const streamWriter = fileWritable.getWriter();

  const fileSink = new OrderedFileSink(streamWriter);

  const zip = new Zip((err, chunk, final) => {
    if (err) throw err;
    fileSink.push(chunk, final);
  });

  return zip;
}

export function makeByteSinkFromFflateEntry(entry: ZipDeflate): ByteSink {
  return {
    push: (chunk, final) => entry.push(chunk, final),
  };
}

export class ThreeMFDocumentWriter {

    _cts?:ThreeMFContentTypes;
    _rs?:ThreeMFRelationships;
    _m?:ThreeMFModel;

    public withContentType(type:ThreeMFContentType ) : ThreeMFDocumentWriter{
        if( !this._cts){
            this._cts = new ThreeMFContentTypes();
        }
        const arr = this._cts.items;
        if (!arr.some(x => x.ext === type.ext && x.ct === type.ct)) arr.push(type);
        return this;
    }
 
    public withRelationship(rel:ThreeMFRelationship) : ThreeMFDocumentWriter{
       if( !this._rs){
            this._rs = new ThreeMFRelationships();
        }
        const arr = this._rs.items;
        if (!arr.some(x => x.id === rel.id)) arr.push(rel);
        // here we ensure that the content type is declared.
        this.withContentType( new ThreeMFContentType("rels", KnownThreeMFContentType.Relationships) );
        return this;

    }

    public withModel(m:ThreeMFModel | ThreeMFModelBuilder): ThreeMFDocumentWriter{
        if( m instanceof ThreeMFModelBuilder){
            m = m.build();
        }
        this._m = m;
        // here we ensure that the content type is declared.
        this.withContentType( new ThreeMFContentType("model", KnownThreeMFContentType.Model) );
        return this;
    }


    public async writeToFileAsync(fileHandle: FileSystemFileHandle) {
        this.writeToZip(await createZipToFile(fileHandle));
    }


    public writeToZip(target: Zip ): void {
        if( !this._m){
            throw new Error("Invalid state: you Must provide at least a model.")
        }
        
        const path = `${Object3dDirName}${ModelFileName}`;
        if( !this._rs){
            const absolutePath = `/${path}`;
            this.withRelationship(new ThreeMFRelationship(`rel${0}`,ThreeMFRelationshipTypes.ThreeDModel, absolutePath ))
        }

        // save the root content type
        this._serializeEntry(target, ContentTypeFileName,this._cts);

        // save the relationships
        this._serializeEntry(target, `${RelationshipDirName}${RelationshipFileName}`,this._rs);

        // save the model
        this._serializeEntry(target, path,this._m);

        target.end();
    }

    private _serializeEntry(target:Zip, name:string,object:any){
        let entry = new ZipDeflate(name, { level: 6 });
        target.add(entry);
        let sink = makeByteSinkFromFflateEntry(entry);
        let w = new Utf8XmlWriterToBytes(sink);
        let b = new XmlBuilder(w).dec("1.0", "UTF-8");
        let s = new XmlSerializer(b);
        s.serialize(object);
        w.finish();
    }
}