// 3MF
import { ThreeMfDocumentBuilder} from "./3mf.builder";
import { ContentTypeFileName, ModelFileName, Object3dDirName, RelationshipDirName, RelationshipFileName, type I3mfDocument } from "./3mf.opc.interfaces";
import type { I3mfModel} from "./3mf.interfaces";


// XML
import { XmlBuilder } from "../xml/xml.builder";
import { XmlSerializer } from "../xml/xml.serializer";
import { type ByteSink, Utf8XmlWriterToBytes } from "../xml/xml.builder.bytes";


/**
 *
 */
export interface IThreeMfSerializerOptions {
    /**  */
    exportInstances?: boolean;
    /**  */
    exportSubmeshes?: boolean;
}

export interface I3mfSerializer<T>{
      serializeAsync(sink: (err: any, chunk: Uint8Array, final: boolean) => void, ...meshes: Array<T>): Promise<void>;
}

/**
 *
 */
export abstract class AbstractThreeMfSerializer<T> implements I3mfSerializer<T> {

    /**
     *
     */
    static DEFAULT_3MF_EXPORTER_OPTIONS: IThreeMfSerializerOptions = {
        exportInstances: false,
        exportSubmeshes: false,
    };

    private _o: IThreeMfSerializerOptions;
    /**
     *
     * @param opts
     */
    public constructor(opts: Partial<IThreeMfSerializerOptions> = {}) {
        this._o = { ...AbstractThreeMfSerializer.DEFAULT_3MF_EXPORTER_OPTIONS, ...opts };
    }

    /**
     *
     */
    public get options(): Readonly<IThreeMfSerializerOptions> {
        return this._o;
    }


    /**
     * Generic 3MF binary serializer.
     * @param meshes the meshes to serialize.
     * @param sink we use sink to acumulate chunk of data into a target. This let's the opportunity to stream the output without storing huge amount of memory.
     */
    public async serializeAsync(sink: (err: any, chunk: Uint8Array, final: boolean) => void, ...meshes: Array<T>): Promise<void> {
        const lib = await this.ensureZipLibReadyAsync();
        if (lib) {
            const zip = lib.Zip;
            const zipDeflate = lib.ZipDeflate;

            if (!zip || !zipDeflate) {
                throw new Error("fflate Zip / ZipDeflate not available");
            }

            const makeByteSinkFromFflateEntry = function (entry: any): ByteSink {
                return { push: (chunk: any, final: any) => entry.push(chunk, final) };
            };

            const serializeEntry = function (target: any, name: string, object: any) {
                const entry = new zipDeflate(name, { level: 6 });
                target.add(entry);
                const sink = makeByteSinkFromFflateEntry(entry);
                const w = new Utf8XmlWriterToBytes(sink);
                const b = new XmlBuilder(w).dec("1.0", "UTF-8");
                const s = new XmlSerializer(b);
                s.serialize(object);
                w.finish();
            };

            const doc = this.toDocument(meshes);
            if (doc) {
                const target = new zip(sink);

                // save the root content type
                serializeEntry(target, ContentTypeFileName, doc.contentTypes);

                // save the relationships
                serializeEntry(target, `${RelationshipDirName}${RelationshipFileName}`, doc.relationships);

                // save the model
                serializeEntry(target, `${Object3dDirName}${ModelFileName}`, doc.model);

                target.end();
            }
        }
    }

    /**
     *
     * @param meshes
     * @returns
     */
    public toDocument(meshes: Array<T>): I3mfDocument | undefined {
        return  new ThreeMfDocumentBuilder().withModel(this.toModel(meshes)).build()
    }

   /**
     *
     * @param meshes
     */
    public abstract toModel(meshes: Array<T>): I3mfModel ;

    /**
     * this might be provide by the framework implementation while this cloud be different depending the host (native, node,browser..)
     */
    public abstract ensureZipLibReadyAsync(): Promise<any>;

}

export class ThreeMf {
    public static async SerializeToMemoryAsync<A>(s:I3mfSerializer<A>, ... meshes :Array<A>) : Promise<Uint8Array|undefined>{
        const chunks = new Array<Uint8Array>();
        let size = 0;
        const sink = function (err: any, chunk: Uint8Array, _final: boolean) {
            chunks.push(chunk);
            size += chunk.length;
        };
        await s.serializeAsync(sink, ...meshes);
        if (size) {
            const buffer = new Uint8Array(size);
            let off = 0;
            for (const c of chunks) {
                buffer.set(c, off);
                off += c.length;
            }
            return buffer;
        }
        return undefined;
    }
}