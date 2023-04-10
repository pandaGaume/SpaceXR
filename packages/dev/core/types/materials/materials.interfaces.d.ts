export interface IShaderLoader {
    resolveAsync(path: string): Promise<string | undefined>;
}
export interface IShaderContent {
    includes: Array<string> | undefined;
    body: string;
}
export interface IShaderMaterial {
    shader: IShaderContent;
}
export declare enum ShaderSource {
    cache = 0,
    loader = 1
}
