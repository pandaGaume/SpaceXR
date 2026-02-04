import { Zip, ZipDeflate } from "fflate";
import { ByteSink, Utf8XmlWriterToBytes } from "../xml/xml.builder.bytes";
import { ContentTypeFileName, ModelFileName, Object3dDirName, RelationshipDirName, RelationshipFileName, ThreeMFContentTypes, ThreeMFRelationships } from "./3mf.opc";
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

  return { zip, fileSink };
}

export function makeByteSinkFromFflateEntry(entry: ZipDeflate): ByteSink {
  return {
    push: (chunk, final) => entry.push(chunk, final),
  };
}

export class ThreeMFContentTypesBuilder {

    _cts:ThreeMFContentTypes = new ThreeMFContentTypes();

    build() : ThreeMFContentTypes{
        return this._cts;
    }
}

export class ThreeMFRelationshipsBuilder {
    _rs:ThreeMFRelationships = new ThreeMFRelationships();

    build() : ThreeMFRelationships{
        return this._rs;
    }
}

export class ThreeMFDocumentWriter {

    _cts?:ThreeMFContentTypes;
    _rs?:ThreeMFRelationships;
    _m?:ThreeMFModel;

    public withContentTypes(types:ThreeMFContentTypes | ThreeMFContentTypesBuilder) : ThreeMFDocumentWriter{
        if( types instanceof ThreeMFContentTypesBuilder){
            types = types.build();
        }
        this._cts = types;
        return this;
    }

    public withRelationships(r:ThreeMFRelationships | ThreeMFRelationshipsBuilder) : ThreeMFDocumentWriter{
        if( r instanceof ThreeMFRelationshipsBuilder){
            r = r.build();
        }
        this._rs = r;
        return this;
    }

    public with3DModel(m:ThreeMFModel | ThreeMFModelBuilder): ThreeMFDocumentWriter{
        if( m instanceof ThreeMFModelBuilder){
            m = m.build();
        }
        this._m = m;
        return this;
    }

    public writeTo(target:Zip) : void {
        if( !this._cts){
            throw new Error("Invalid state: you Must provide a valid content types definition.")
        }
        if( !this._rs){
            throw new Error("Invalid state: you Must provide a valid relationships definition.")
        }
        if( !this._m){
            throw new Error("Invalid state: you Must provide at least a model.")
        }

        // save the root content type
        this._serializeEntry(target, ContentTypeFileName,this._cts);

        // save the relationships
        this._serializeEntry(target, `${RelationshipDirName}${RelationshipFileName}`,this._rs);

        // save the model
        this._serializeEntry(target, `${Object3dDirName}${ModelFileName}`,this._m);

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