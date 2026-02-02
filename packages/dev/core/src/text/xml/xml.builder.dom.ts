import { IXmlWriter } from "./xml.builder";

export class DomXmlWriter implements IXmlWriter {
  public count = 0;

  private _el: HTMLElement;
  private _buf: string[] = [];
  private _scheduled = false;

  constructor(el: HTMLElement) {
    this._el = el;
  }

  write(...data: string[]): IXmlWriter {
    if (data.length === 0) return this;

    const s = data.join("");
    this._buf.push(s);
    this.count += s.length;

    if (!this._scheduled) {
      this._scheduled = true;
      requestAnimationFrame(() => this._flush());
    }

    return this;
  }

  private _flush() {
    this._scheduled = false;
    const s = this._buf.join("");
    this._buf.length = 0;

    // append as text, no HTML injection
    this._el.appendChild(document.createTextNode(s));

    // keep scrolled to bottom if you want
    const anyEl = this._el as any;
    if (typeof anyEl.scrollTop === "number") {
      anyEl.scrollTop = anyEl.scrollHeight;
    }
  }

  clear(): void {
    this._buf.length = 0;
    this._scheduled = false;
    this._el.textContent = "";
    this.count = 0;
  }
}
