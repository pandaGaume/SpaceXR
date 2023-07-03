import { AbstractMesh, Material, Mesh, Nullable, Scene, ShaderMaterial, Tools, Vector3, VertexData } from "@babylonjs/core";

import { IGeo2 } from "core/geography/geography.interfaces";
import { Geo2 } from "core/geography/geography.position";
import { AbstractDisplayMap } from "core/map";
import { ITile, ITileAddress, ITileDatasource } from "core/tiles/tiles.interfaces";
import { TerrainGridOptions, TerrainGridOptionsBuilder, TerrainNormalizedGridBuilder } from "core/meshes/terrain.grid";
import { ICartesian3, IRectangle } from "core/geometry/geometry.interfaces";
import { Cartesian3 } from "core/geometry/geometry.cartesian";

import { SurfaceMapDisplay } from "./terrain.mapDisplay";
import { TerrainTile } from "../terrain.tile";
import { IDemInfos } from "core/dem/dem.interfaces";

export class SurfaceTileMapOptions {
    public static Default = new SurfaceTileMapOptions({
        center: Geo2.Zero(),
        levelOfDetail: 10,
        gridOptions: TerrainGridOptions.Shared,
        insets: Cartesian3.Zero(),
    });

    center?: IGeo2;
    levelOfDetail?: number;
    gridOptions?: TerrainGridOptions;
    insets?: ICartesian3;

    public constructor(p: Partial<SurfaceTileMapOptions>) {
        Object.assign(this, p);
    }
}

export class SurfaceTileMapOptionsBuilder {
    _center?: IGeo2;
    _lod?: number;
    _gridOptions?: TerrainGridOptions;
    _insets?: ICartesian3;

    public withCenter(v?: IGeo2): SurfaceTileMapOptionsBuilder {
        this._center = v;
        return this;
    }
    public withLeveOfDetail(v?: number): SurfaceTileMapOptionsBuilder {
        this._lod = v;
        return this;
    }
    public withGridOptions(v?: TerrainGridOptions): SurfaceTileMapOptionsBuilder {
        this._gridOptions = v;
        return this;
    }
    public withInsets(v?: ICartesian3): SurfaceTileMapOptionsBuilder {
        this._insets = v;
        return this;
    }
    public build(): SurfaceTileMapOptions {
        return new SurfaceTileMapOptions({ center: this._center, levelOfDetail: this._lod, gridOptions: this._gridOptions, insets: this._insets });
    }
}

export class SurfaceTileMap<V extends IDemInfos, H extends SurfaceMapDisplay> extends AbstractDisplayMap<V, TerrainTile<V>, H> {
    private static InitZ(column: number, row: number, w: number, h: number): number {
        let i = column == w - 1 ? 1 : 0;
        let j = row == h - 1 ? 2 : 0;
        return i + j;
    }

    // private static InitUV(column: number, row: number, w: number, h: number): number[] {
    //     let u = column == w - 1 ? 0 : column / (w - 2);
    //     let v = row == h - 1 ? 0 : row / (h - 2);
    //     return [u, v];
    // }

    _grid: VertexData;
    _template: Mesh;
    _options: SurfaceTileMapOptions;

    _offset?: Vector3;

    public constructor(name: string, display: H, datasource: ITileDatasource<V, ITileAddress>, options?: SurfaceTileMapOptions, scene?: Nullable<Scene>) {
        const o = { ...SurfaceTileMapOptions.Default, ...options };
        super(display, datasource, o.center, o.levelOfDetail);
        this._options = o;
        this._grid = this.buildGrid();
        this._template = this.buildMesh(name, scene);
        this._template.material = this.buildMaterial(scene);
    }

    public get template(): Mesh {
        return this._template;
    }

    public hasMesh(mesh: Mesh): boolean {
        return this._activ.has(mesh.name);
    }

    protected buildGrid(): VertexData {
        // build topology
        const s = this.metrics?.tileSize;

        const o = new TerrainGridOptionsBuilder()
            .withUvs(true)
            .withColumns(s + 1) // add one to row and column to fill the gap - note that if only column/row are defined, the builder build a square
            .withScale(1, -1) // we consider a grid of "texel" or "pixel" oriented as an image is oriented in display
            .withInvertIndices(true) //  we need to invert indices as we reverse y
            .withZInitializer(SurfaceTileMap.InitZ)
            //.withUVInitializer(SurfaceTileMap.InitUV)
            .build();
        const data = new TerrainNormalizedGridBuilder().withOptions(o).build<VertexData>(new VertexData());
        return data;
    }

    protected buildMesh(name: string, scene?: Nullable<Scene>): Mesh {
        const mesh = new Mesh(name, scene);
        //const normals: Array<number> = [];
        //VertexData.ComputeNormals(this._grid.positions, this._grid.indices, normals);
        //this._grid.normals = normals;
        this._grid.applyToMesh(mesh, true);

        // define material
        // mesh.material = new MapMaterial(`${name}_material`, scene);

        // define instance properties using .registerInstancedBuffer
        mesh.setEnabled(false);
        return mesh;
    }

    protected buildInstance(name: string, tile: TerrainTile<V>): Nullable<AbstractMesh> {
        // fill instanced properties - which are declared into buildTemplate - with instance.instancedBuffers
        //const a = tile.address;
        //instance.instancedBuffers.address = new Vector3(a.x, a.y, a.levelOfDetail);$
        const infos = tile.content;
        if (infos) {
            const instance = this._template.createInstance(name);
            return instance;
        }
        return null;
    }

    protected buildMapTile(t: ITile<V>): TerrainTile<V> {
        return new TerrainTile(t);
    }

    protected onDeleted(key: string, tile: TerrainTile<V>): void {
        // remove from the scene.
        tile.dispose();
    }

    // TODO,introduce metrics overlaps
    protected onAdded(key: string, tile: TerrainTile<V>): void {
        // create the instance
        const instance = this.buildInstance(key, tile);
        if (instance) {
            instance.scaling.x = instance.scaling.y = this.metrics.tileSize;
            instance.parent = this.display.context;
            tile.surface = instance;
        }
    }

    protected invalidateDisplay(rect?: IRectangle): void {
        this.invalidate(this._activ.values());
    }

    protected invalidateTiles(added: TerrainTile<V>[] | undefined, removed: TerrainTile<V>[] | undefined): void {
        if (added) {
            this.invalidate(added);
        }
    }

    protected buildMaterial(scene?: Nullable<Scene>): Nullable<Material> {
        if (!scene) {
            // shader material need scene to access engine..
            return null;
        }

        const materialName = "tilemap";
        const shaderOptions = {
            attributes: ["position"],
            uniforms: ["world", "viewProjection", "demInfos", "light", "material", "northClip", "southClip", "westClip", "eastClip"],
            samplers: ["altitudes", "normals"],
        };

        var m = new ShaderMaterial(
            materialName,
            scene,
            {
                vertex: materialName,
                fragment: materialName,
            },
            shaderOptions
        );

        m.setVector3("light.ambient", new Vector3(0.2, 0.2, 0.2));
        m.setVector3("material.ambient", new Vector3(0.1, 0.5, 0.8));
        m.setVector3("light.diffuse", new Vector3(0.5, 0.5, 0.5));
        m.setVector3("material.diffuse", new Vector3(0.5, 0.8, 0.8));

        m.setVector3("light.direction", new Vector3(1, 1, 1).normalize());

        const axes = this.display.getXYZWorldVectors();
        const res = this.display.resolution;
        const w2 = res.width / 2;
        const h2 = res.height / 2;

        const vx = axes[0].multiply(new Vector3(w2, w2, w2));
        const vy = axes[1].multiply(new Vector3(h2, h2, h2));

        const p = this.display.getAbsolutePosition();

        let a = p.subtract(vy);
        let b = axes[1];
        m.setVector3("northClip.point", a);
        m.setVector3("northClip.normal", b);

        let a1 = p.add(vy);
        let b1 = axes[1].negate();
        m.setVector3("southClip.point", a1);
        m.setVector3("southClip.normal", b1);

        let a2 = p.subtract(vx);
        let b2 = axes[0];
        m.setVector3("westClip.point", a2);
        m.setVector3("westClip.normal", b2);

        let a3 = p.add(vx);
        let b3 = axes[0].negate();
        m.setVector3("eastClip.point", a3);
        m.setVector3("eastClip.normal", b3);

        return m;
    }

    private invalidate(tiles: IterableIterator<TerrainTile<V>> | Array<TerrainTile<V>>) {
        const scale = Math.abs(this._scale);
        // this is the center expressed in "texel" or "pixel"
        const center = this._center;
        const context = this.display.context;

        context.scaling = new Vector3(scale / this.display._ppu.x, scale / this.display._ppu.y, 1);

        if (this.azimuth !== undefined) {
            context.rotation.z = Tools.ToRadians(this.azimuth);
        }

        const offset = this._offset || Vector3.Zero();
        for (const t of tiles) {
            if (t.content && t.rect && t.surface) {
                // this is the rect expressed in "texel" or "pixel"
                const c = t.rect.center;
                t.surface.position.x = c.x - center.x + offset.x;
                t.surface.position.y = c.y - center.y + offset.y;
                t.surface.position.z = offset.z;
            }
        }
    }
}
