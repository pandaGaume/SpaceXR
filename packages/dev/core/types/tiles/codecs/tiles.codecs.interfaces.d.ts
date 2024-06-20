export interface IPixelDecoder<T> {
    decode(pixels: Uint8ClampedArray, offset: number, target: T, targetOffset: number): number;
}
export interface IFilter<T> {
    apply(values: T, x: number, y: number, width: number, height: number): T;
}
export declare function isFilter<T>(f: any): f is IFilter<T>;
