import { Nullable, FloatArray, IndicesArray } from "../types";

export interface IVerticesData {
    /**
     * An array of the x, y, z position of each vertex  [...., x, y, z, .....]
     */
    positions: Nullable<FloatArray>;

    /**
     * An array of the x, y, z normal vector of each vertex  [...., x, y, z, .....]
     */
    normals: Nullable<FloatArray>;

    /**
     * An array of u,v which maps a texture image onto each vertex  [...., u, v, .....]
     */
    uvs: FloatArray;

    /**
     * An array of i, j, k the three vertex indices required for each triangular facet  [...., i, j, k .....]
     */
    indices: Nullable<IndicesArray>;
}

export interface IVerticesDataBuilder {
    build(): IVerticesData;
}
