import { IShaderContent, IShaderLoader, ShaderSource } from "./materials.interfaces";
declare class ShaderLoadResult {
    source: ShaderSource;
    key: string;
    shader: IShaderContent;
    constructor(source: ShaderSource, key: string, shader: IShaderContent);
}
export declare class ShaderWebLoader implements IShaderLoader {
    private _base?;
    constructor(base?: string);
    resolveAsync(path: string): Promise<string | undefined>;
}
export declare class ShaderManager {
    private static ParseIncludePaths;
    static Load(path: string, loader: IShaderLoader, cache: Map<string, IShaderContent>): Promise<ShaderLoadResult | undefined>;
    private _cache;
    private _loader;
    constructor(loader: IShaderLoader, cache: Map<string, IShaderContent>);
    get cache(): Map<string, IShaderContent>;
    getAsync(path: string): Promise<IShaderContent | undefined>;
}
export {};
