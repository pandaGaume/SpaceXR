export interface IPixelDecoder<T> {
    decode(pixels: Uint8ClampedArray, offset: number, target: T, targetOffset: number): number;
}
