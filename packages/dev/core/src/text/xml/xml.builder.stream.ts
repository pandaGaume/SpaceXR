import { IXmlWriter } from "./xml.builder";

export class StreamUtf8XmlWriter implements IXmlWriter {
  public count = 0;

  private _encoder = new TextEncoder();
  private _pending = "";
  private _pendingChars = 0;

  public constructor(
    private readonly enqueue: (chunk: Uint8Array) => void,
    private readonly opts: { flushChars?: number } = {}
  ) {}

  public write(...data: string[]): IXmlWriter {
    if (data.length === 0) return this;
    const s = data.join("");
    if (!s) return this;

    this._pending += s;
    this._pendingChars += s.length;

    const limit = this.opts.flushChars ?? 64 * 1024;
    if (this._pendingChars >= limit) this.flush();

    return this;
  }

  public flush(): void {
    if (this._pendingChars === 0) return;
    const bytes = this._encoder.encode(this._pending);
    this.enqueue(bytes);
    this.count += bytes.length;
    this._pending = "";
    this._pendingChars = 0;
  }

  public clear(): void {
    this._pending = "";
    this._pendingChars = 0;
    this.count = 0;
  }
}
