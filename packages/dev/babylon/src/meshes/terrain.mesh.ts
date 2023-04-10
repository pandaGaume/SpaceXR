import { InstancedMesh, Mesh, Nullable, Scene, TransformNode, Vector2, VertexData } from "@babylonjs/core";
import { IVerticesData } from "spacegx/meshes/meshes.interfaces";
import { TerrainGridOptions, TerrainGridBuilder } from "spacegx/meshes/terrain.grid";
import { Angle } from "spacegx/math/math.units";

declare module "@babylonjs/core/meshes/mesh.vertexData" {
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface VertexData extends IVerticesData {}
}

export class TerrainTileOptions {
    public static DefaultRows = 4;
    public static DefaultColumns = 4;
    public static DefaultWidth = 360.0 / TerrainTileOptions.DefaultColumns;
    public static DefaultHeight = 180.0 / TerrainTileOptions.DefaultRows;
    public static DefaultLat = -90;
    public static DefaultLon = 0;

    public static Default(rows: number = TerrainTileOptions.DefaultRows, columns: number = TerrainTileOptions.DefaultColumns): TerrainTileOptions {
        return <TerrainTileOptions>{
            lon: 0,
            lat: -90,
            width: 360 / columns,
            height: 180 / rows,
            rows: rows,
            columns: columns,
        };
    }

    lon: number = TerrainTileOptions.DefaultLat;
    lat: number = TerrainTileOptions.DefaultLon;
    width: number = TerrainTileOptions.DefaultWidth;
    height: number = TerrainTileOptions.DefaultHeight;
    rows: number = TerrainTileOptions.DefaultRows;
    columns: number = TerrainTileOptions.DefaultColumns;
}

export class TerrainMeshOptions {
    gridOptions?: TerrainGridOptions;
    tileOptions?: TerrainTileOptions;
}

export class TerrainMeshOptionsBuilder {
    private _gridOptions?: TerrainGridOptions;

    public withGridOptions(v?: TerrainGridOptions): TerrainMeshOptionsBuilder {
        this._gridOptions = v;
        return this;
    }

    public build(): TerrainMeshOptions {
        const v = new TerrainMeshOptions();
        v.gridOptions = this._gridOptions || TerrainGridOptions.Default();
        return v;
    }
}

export class TerrainMesh extends TransformNode {
    public static TilePrefix = "tile";
    public static Separator = "_";
    public static GridExtension = ".grid";
    public static CenterVariableName = "center";
    public static SizeVariableName = "size";

    private static GenerateGridModel(name: string, go: TerrainGridOptions, scene: Nullable<Scene> | undefined): Nullable<Mesh> {
        const data = <VertexData>new TerrainGridBuilder().withOptions(go).build(new VertexData());
        if (data) {
            const mesh = new Mesh(name, scene);
            data.applyToMesh(mesh, true);
            return mesh;
        }
        return null;
    }

    private static GenerateGridInstances(pivot: TransformNode, grid: Nullable<Mesh>, to: TerrainTileOptions): Nullable<Array<InstancedMesh>> {
        if (grid) {
            const instances: Array<InstancedMesh> = [];

            const dlat = (to.height * Angle.DE2RA) / to.rows;
            const dlon = (to.width * Angle.DE2RA) / to.columns;
            const size = new Vector2(dlat, dlon);

            // set the buffer for the uniforms for each instances
            grid.registerInstancedBuffer(TerrainMesh.CenterVariableName, 2);
            grid.registerInstancedBuffer(TerrainMesh.SizeVariableName, 2);

            // create the tiles (instances)
            for (let j = 0; j < to.rows; j++) {
                const lat = to.lat + dlat * (j + 0.5);
                for (let i = 0; i < to.columns; i++) {
                    const lon = to.lon + dlon * (i + 0.5);
                    const name = [pivot.name, TerrainMesh.TilePrefix, lat, lon].join(TerrainMesh.Separator);
                    const instance = grid.createInstance(name);
                    instance.instancedBuffers.center = new Vector2(lon, lat);
                    instance.instancedBuffers.size = size;
                    instance.parent = pivot;
                    instances.push(instance);
                }
            }
            return instances;
        }
        return null;
    }

    private _o: TerrainMeshOptions;
    private _grid: Nullable<Mesh> = null;
    private _instances: Nullable<Array<InstancedMesh>> = null;

    public constructor(name: string, options: TerrainMeshOptions, scene: Nullable<Scene> | undefined) {
        super(name, scene);
        this._o = options;
        if (this._o.gridOptions && this._o.tileOptions) {
            this._grid = TerrainMesh.GenerateGridModel(name + TerrainMesh.GridExtension, this._o.gridOptions, scene);
            this._instances = TerrainMesh.GenerateGridInstances(this, this._grid, this._o.tileOptions);
            this._grid?.setEnabled(false);
        }
        // here we check that everything has been created.
        if (!this._grid || !this._instances) {
            return;
        }
    }
}
