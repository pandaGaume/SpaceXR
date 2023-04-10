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

export enum ShaderSource {
    cache,
    loader,
}
