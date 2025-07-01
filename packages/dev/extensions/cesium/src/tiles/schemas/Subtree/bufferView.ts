/**
 * A contiguous subset of a buffer
 */
export interface IBufferView {
    /**
     * The index of the buffer.
     */
    buffer: number;
    /**
     * The offset into the buffer in bytes.
     */
    byteOffset: number;
    /**
     * The total byte length of the buffer view.
     */
    byteLength: number;
    /**
     * The name of the `bufferView`.
     */
    name?: string;
    [k: string]: unknown;
}
