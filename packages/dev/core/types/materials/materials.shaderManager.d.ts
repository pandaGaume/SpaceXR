import { EventEmitter } from "../events";
import { IShaderContent, IShaderLoader } from "./materials.interfaces";
export declare class ShaderWebLoader implements IShaderLoader {
    private _bases?;
    constructor(...bases: string[]);
    resolveAsync(path: string): Promise<string | undefined>;
}
export declare class ShaderManager extends EventEmitter {
    private static ParseIncludePaths;
    private _cache;
    private _loader;
    constructor(loader: IShaderLoader, cache: Map<string, IShaderContent>);
    get cache(): Map<string, IShaderContent>;
    getAsync(path: string): Promise<IShaderContent | undefined>;
    private load;
}
