/** Alias type for value that can be null */
export type Nullable<T> = T | null;

export type SingleOrArray<T> = T | Array<T>;

export interface IDisposable {
    dispose(): void;
}
