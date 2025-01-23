import { AbstractMesh, Scene, TransformNode } from "@babylonjs/core";
import { IDisplay, IImageTileMapLayer, ImageLayerContentType, ITileView, TileMapLayerView } from "core/tiles";
import { Nullable } from "core/types";
import { IElevationHost, ITileMapLayerViewWithElevation } from "./map.interfaces";
import { Map3D } from "./map";
import { ICartesian2 } from "core/geometry";
import { TileWithElevation } from "./map.tile";

export class TileMapLayerViewWithElevation extends TileMapLayerView<ImageLayerContentType> implements ITileMapLayerViewWithElevation {
    _tilesRoot: TransformNode;
    _elevationHost: IElevationHost;
    // cached cartesian center
    _cartesianCenterCache: Nullable<ICartesian2> = null;

    public constructor(host: IElevationHost, layer: IImageTileMapLayer, display: Nullable<IDisplay>, source: ITileView, scene?: Scene) {
        super(layer, display, source);
        this._elevationHost = host;
        // ensure factory is with correct type.
        this.factory.withType(TileWithElevation);
        this._tilesRoot = this._buildRoot(scene);
    }

    public get elevationHost(): IElevationHost {
        return this._elevationHost;
    }

    public get tilesRoot(): TransformNode {
        return this._tilesRoot;
    }

    protected _buildRoot(scene?: Scene): TransformNode {
        return new TransformNode(this._buildRootName(), scene);
    }

    protected _buildRootName(): string {
        return `${this.layer.name}-root`;
    }

    protected _onTilesAdded(tiles: Array<TileWithElevation>): void {
        if (this._tilesRoot) {
            this._tilesRoot.getScene().onBeforeRenderObservable.addOnce(() => {
                for (const t of tiles) {
                    this._onTileAdded(t);
                }
            });
        } else {
            super._onTilesAdded(tiles);
        }
    }

    protected _onTileAdded(tile: TileWithElevation): void {
        const m = this._buildInstance(tile);
        if (m) {
            m.parent = this._tilesRoot;

            m.scaling.x = m.scaling.y = this.metrics.tileSize;
            m.scaling.z = 1.0; // exageration is hold by the tiles root scaling.

            // set the surface 3D
            tile.surface = m;

            if (!tile.content) {
                m.setEnabled(false);
            }
            const center = this._getCenter(true);
            if (center) {
                this._setTilePosition(tile, center);
            }
        }
        this.elevationHost.material?.addTile(tile, this);
    }

    protected _onTilesRemoved(tiles: Array<TileWithElevation>): void {
        if (this._tilesRoot) {
            this._tilesRoot.getScene().onBeforeRenderObservable.addOnce(() => {
                for (const t of tiles) {
                    this._onTileRemoved(t);
                }
            });
        } else {
            super._onTilesRemoved(tiles);
        }
    }

    protected _onTileRemoved(tile: TileWithElevation): void {
        if (tile.surface) {
            tile.surface.dispose();
            tile.surface = null;
        }
        this.elevationHost.material?.removeTile(tile, this);
    }

    protected _onTilesUpdated(tiles: Array<TileWithElevation>): void {
        if (this._tilesRoot) {
            this._tilesRoot.getScene().onBeforeRenderObservable.addOnce(() => {
                for (const t of tiles) {
                    this._onTileUpdated(t);
                }
            });
        } else {
            super._onTilesUpdated(tiles);
        }
    }

    protected _onTileUpdated(tile: TileWithElevation): void {
        if (tile.surface) {
            tile.surface.setEnabled(tile.content !== null && tile.content !== undefined);
        }
        this.elevationHost.material?.updateTile(tile, this);
    }

    protected _buildInstance(tile: TileWithElevation): AbstractMesh {
        const instance = this._elevationHost.grid.createInstance(this._buildInstanceName(tile));
        return instance;
    }

    protected _buildInstanceName(tile: TileWithElevation): string {
        const k = tile.quadkey;
        return k != "" ? k : Map3D.INSTANCE_ROOT_NAME;
    }

    protected _setTilePosition(tile: TileWithElevation, center: ICartesian2): void {
        if (tile?.bounds && tile?.surface) {
            const c = tile.bounds.center;
            const p = tile.surface.position;
            // the tile system is origin north-west corner, y pointing to the south, x to the east.
            p.x = center.x - c.x;
            p.y = center.y - c.y;
            p.z = 0;
        }
    }

    protected _getCenter(force: boolean = false): ICartesian2 | undefined {
        const nav = this.navigationState;
        if (nav) {
            if (force || !this._cartesianCenterCache) {
                const geo = nav.center;
                this._cartesianCenterCache = this.metrics.getLatLonToPointXY(geo.lat, geo.lon, nav.lod);
            }
            return this._cartesianCenterCache;
        }
        return undefined;
    }
}
