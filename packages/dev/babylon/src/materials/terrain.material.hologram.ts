import { PushMaterial, Scene, Effect, Mesh, Matrix, AbstractMesh, Constants, Vector4 } from "@babylonjs/core";
import { SurfaceMapDisplay, SurfaceTileMap, TerrainTile } from "../terrain";
import { IDemInfos } from "core/dem";
import { EventState, Observer } from "core/events";
import { Nullable } from "core/types";
import { ITilePoolTexture, ITilePoolTextureArea, TilePoolTexture, TilePoolTextureOptions } from "./textures/tilePoolTexture";
import { ITileClient } from "..";

// internal class used to hold the tile pool texture areas
class TileBag {
    public elevationArea: Nullable<ITilePoolTextureArea> = null;
    public normalArea: Nullable<ITilePoolTextureArea> = null;
    public layerArea: Nullable<ITilePoolTextureArea> = null;
}

export class TerrainHologramMaterialOptions {
    public layerClient?: ITileClient<HTMLImageElement>;
}

/// <summary> TerrainHologramMaterial is to use in conjunction with the SurfaceTileMap Template property.
/// Consequetly it has to listen to the underlying MapView to get the current tile and its properties.
/// </summary>
export class TerrainHologramMaterial<V extends IDemInfos, H extends SurfaceMapDisplay> extends PushMaterial {
    public static ClassName: string = "TerrainHologramMaterial";
    public static ElevationTextureName: string = "altitudes";
    public static NormalTextureName: string = "normals";
    public static LayerTextureName: string = "layer";

    private _map: SurfaceTileMap<V, H>;
    private _layerClient?: ITileClient<HTMLImageElement>;

    // tile bags is holding the area infrormation provided by TilePoolTexture for each activ tile.
    // This pattern is used to avoid creating a new derived class for each type of tile, or new Decorator class.
    private _tileBags: Map<string, TileBag>;

    private _added: Nullable<Observer<TerrainTile<V>>>;
    private _updated: Nullable<Observer<TerrainTile<V>>>;
    private _removed: Nullable<Observer<TerrainTile<V>>>;

    private _elevationSampler: Nullable<ITilePoolTexture>;
    private _normalSampler: Nullable<ITilePoolTexture>;
    private _layerSampler: Nullable<ITilePoolTexture>;

    constructor(name: string, map: SurfaceTileMap<V, H>, options: TerrainHologramMaterialOptions, scene: Scene) {
        super(name, scene);
        this._map = map;
        this._removed = this._map.removedObservable.add(this._onTileRemoved.bind(this), -1, true); // last parameter is to insert at the beginning of the list
        this._added = this._map.addedObservable.add(this._onTileAdded.bind(this));
        this._updated = this._map.updatedObservable.add(this._onTileUpdated.bind(this));
        this._tileBags = new Map<string, TileBag>();
        this._elevationSampler = null;
        this._normalSampler = null;
        this._layerSampler = null;
        this._layerClient = options?.layerClient;

        this._constructTextures(scene);
    }

    public get LayerClient(): ITileClient<HTMLImageElement> | undefined {
        return this._layerClient;
    }

    public set LayerClient(v: ITileClient<HTMLImageElement> | undefined) {
        if (this._layerClient !== v) {
            this._layerClient = v;
            if (v) {
                // Todo, reset the layer sampler
            }
        }
    }

    public override getClassName(): string {
        return TerrainHologramMaterial.ClassName;
    }

    // Override the isReady method
    public override isReady(mesh: AbstractMesh, useInstances: boolean): boolean {
        // Perform your readiness checks here
        // Return true if the material is ready for use
        return super.isReady();
    }

    // Override the getEffect method
    public override getEffect(): Effect {
        // Create and return your custom rendering effect here
        return super.getEffect();
    }

    // Override the bind method
    public override bind(world: Matrix, mesh: Mesh): void {
        // Set values of custom uniforms here
    }

    // Override the unbind method
    public override unbind(): void {
        // Reset values of custom uniforms here
    }

    // Override the dispose method
    public override dispose(forceDisposeEffect: boolean = false): void {
        this._added?.dispose();
        this._updated?.dispose();
        this._removed?.dispose();

        for (var bag of this._tileBags.values()) {
            bag.elevationArea?.release();
            bag.normalArea?.release();
            bag.layerArea?.release();
        }
        this._tileBags.clear();

        // Release resources here
        super.dispose(forceDisposeEffect);
    }

    // Override the clone method
    public override clone(name: string): TerrainHologramMaterial<V, H> {
        // Create and return a copy of the material with specific properties
        var options = new TerrainHologramMaterialOptions();
        options.layerClient = this._layerClient;
        return new TerrainHologramMaterial<V, H>(name, this._map, options, this.getScene());
    }

    private _onTileAdded(eventData: TerrainTile<V>, eventState: EventState): void {
        const mesh = eventData.surface;
        if (mesh) {
            mesh.instancedBuffers.layerIds = new Vector4(0, -1, -1, -1);
        }
    }

    private _onTileUpdated(eventData: TerrainTile<V>, eventState: EventState): void {
        const mesh = eventData.surface;
        if (mesh) {
            mesh.instancedBuffers.layerIds = new Vector4(0, -1, -1, -1);
            // retreive or build the corresponding bag
            let bags = this._tileBags.get(eventData.address.quadkey);
            if (!bags) {
                bags = new TileBag();
                this._tileBags.set(eventData.address.quadkey, bags);
            }
            const elevationArea = this._elevationSampler?.reserveArea();
            const normalArea = this._normalSampler?.reserveArea();
            if (elevationArea && normalArea) {
                bags.elevationArea = elevationArea;
                bags.normalArea = normalArea;
            }
            const layerArea = this._layerSampler?.reserveArea();
            if (layerArea) {
                bags.layerArea = layerArea;
            }
        }
    }

    private _onTileRemoved(eventData: TerrainTile<V>, eventState: EventState): void {
        let bags = this._tileBags.get(eventData.address.quadkey);
        if (bags) {
            bags.elevationArea?.release();
            bags.normalArea?.release();
            bags.layerArea?.release();
            this._tileBags.delete(eventData.address.quadkey);
        }
    }

    private _constructTextures(scene: Scene): void {
        var metrics = this._map.metrics;

        // first remember we need to calculate the depth of the pool, which is the maximum number of texture tile we may have
        const s = metrics.tileSize;
        var display = this._map.display;
        const resw = display.resolution.width;
        const resh = display.resolution.height;
        // remember that this diagonal value is calculated as mid-zoom level, which mean
        // that the maximum size will be at lower zoom  and a scale of 1.5
        const diag = Math.sqrt(resw * resw + resh * resh) * 1.5;
        const ntiles = Math.floor(diag / s) + 1;
        const depth = ntiles * ntiles;

        const tilePoolElevationOptions = new TilePoolTextureOptions({
            metrics: metrics,
            count: depth,
            format: Constants.TEXTUREFORMAT_R,
            textureType: Constants.TEXTURETYPE_FLOAT,
            samplingMode: Constants.TEXTURE_NEAREST_NEAREST,
            internalFormat: scene.getEngine()._gl.R16F, // force internal format to save half space
        });
        this._elevationSampler = new TilePoolTexture(TerrainHologramMaterial.ElevationTextureName, tilePoolElevationOptions, scene);

        const tilePoolNormalOptions = new TilePoolTextureOptions({
            metrics: metrics,
            count: depth,
            format: Constants.TEXTUREFORMAT_RGB,
            textureType: Constants.TEXTURETYPE_UNSIGNED_BYTE,
            samplingMode: Constants.TEXTURE_BILINEAR_SAMPLINGMODE,
            internalFormat: scene.getEngine()._gl.RGB8, // force internal format
        });
        this._normalSampler = new TilePoolTexture(TerrainHologramMaterial.NormalTextureName, tilePoolNormalOptions, scene);

        const tilePoolLayerOptions = new TilePoolTextureOptions({
            metrics: metrics,
            count: depth,
            format: Constants.TEXTUREFORMAT_RGB,
            textureType: Constants.TEXTURETYPE_UNSIGNED_BYTE,
            samplingMode: Constants.TEXTURE_BILINEAR_SAMPLINGMODE,
            internalFormat: scene.getEngine()._gl.RGB8, // force internal format
        });
        this._layerSampler = new TilePoolTexture(TerrainHologramMaterial.LayerTextureName, tilePoolLayerOptions, scene);
    }
}
