import { EventEmitter } from "../events";
import { IShaderContent, IShaderLoader, ShaderSource } from "./materials.interfaces";

class ShaderLoadResult {
    constructor(public source: ShaderSource, public key: string, public shader: IShaderContent) {}
}

export class ShaderWebLoader implements IShaderLoader {
    private _bases?: string | Array<string>;

    constructor(...bases: string[]) {
        this._bases = bases;
    }

    public async resolveAsync(path: string): Promise<string | undefined> {
        const pat = /^https?:\/\//i;
        if (pat.test(path)) {
            // this mean relative at 99%
            if (this._bases) {
                for (const base of this._bases) {
                    const str = await fetch(new URL(path, base));
                    if (str.ok) {
                        return await str.text();
                    }
                }
            }
        }
        return undefined;
    }
}

export class ShaderManager extends EventEmitter {
    private static ParseIncludePaths(source: string): string[] | undefined {
        const importPattern = /#include "([./\w_-]+)"/gi;
        let match = importPattern.exec(source);
        if (match != null) {
            const result = [];
            do {
                result.push(match[1]);
                match = importPattern.exec(source);
            } while (match != null);
            return result;
        }
        return undefined;
    }

    private _cache: Map<string, IShaderContent>;
    private _loader: IShaderLoader;

    public constructor(loader: IShaderLoader, cache: Map<string, IShaderContent>) {
        super(10); // max listener of 10 is a way enought.
        this._loader = loader;
        this._cache = cache || new Map<string, IShaderContent>();
    }

    public get cache(): Map<string, IShaderContent> {
        return this._cache;
    }

    public async getAsync(path: string): Promise<IShaderContent | undefined> {
        const result = await this.load(path, this._loader, this._cache, false, true);
        return result ? result.shader : undefined;
    }

    private async load(path: string, loader: IShaderLoader, cache: Map<string, IShaderContent>, isInclude: boolean, optimize = false): Promise<ShaderLoadResult | undefined> {
        let content = cache.get(path);
        if (content) {
            return new ShaderLoadResult(ShaderSource.cache, path, content);
        }
        let body = await loader.resolveAsync(path);
        if (body) {
            if (optimize) {
                // this block is extracted from Babylonjs BuildShader code from BuildTools.
                body = body
                    .replace(/^\uFEFF/, "")
                    .replace(/(\/\/)+.*$/gm, "")
                    .replace(/\t+/gm, " ")
                    .replace(/^\s+/gm, "")
                    // eslint-disable-next-line no-useless-escape
                    .replace(/ ([\*\/\=\+\-\>\<]+) /g, "$1")
                    .replace(/,[ \n]/g, ",")
                    .replace(/ {1,}/g, " ")
                    .replace(/^#(.*)/gm, "#$1\n")
                    .replace(/\{\n([^#])/g, "{$1")
                    .replace(/\n\}/g, "}")
                    .replace(/^(?:[\t ]*(?:\r?\n|\r))+/gm, "")
                    .replace(/;\n([^#])/g, ";$1");
            }
            content = <IShaderContent>{ includes: undefined, body: body };
            content.includes = ShaderManager.ParseIncludePaths(body);
            if (content.includes) {
                for (const p of content.includes) {
                    const result = await this.load(p, loader, cache, true, optimize);
                    if (result) {
                        if (result.source == ShaderSource.loader) {
                            this.emit("onShader", result.key, result.shader, true);
                        }
                    }
                }
            }
            const result = new ShaderLoadResult(ShaderSource.loader, path, content);
            if (result) {
                this.emit("onShader", result.key, result.shader, isInclude);
            }
            return result;
        }
        return undefined;
    }
}
