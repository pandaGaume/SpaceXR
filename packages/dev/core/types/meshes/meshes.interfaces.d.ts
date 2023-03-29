import { Nullable, FloatArray, IndicesArray } from "../types";
export interface IVerticesData {
    positions: Nullable<FloatArray>;
    normals: Nullable<FloatArray>;
    uvs: Nullable<FloatArray>;
    indices: Nullable<IndicesArray>;
}
export interface IVerticesDataBuilder {
    build(data: IVerticesData): IVerticesData;
}
