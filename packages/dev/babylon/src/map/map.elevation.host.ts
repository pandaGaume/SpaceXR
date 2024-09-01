import { IDemInfos } from "core/dem";
import { ITileNavigationState, ITileView, TileMapLayerView } from "core/tiles";
import { IElevationHost, IElevationLayer, IsElevationLayer } from "./map.elevation.interfaces";
import { ElevationGridFactory } from "./map.elevation.host.factory";
import { AbstractMesh, Mesh, Scene, TransformNode, VertexData } from "@babylonjs/core";
import { ElevationTile, IElevationTile } from "./map.elevation.mesh";
import { ICartesian2 } from "core/geometry";
import { Nullable } from "core/types";
import { Assert } from "core/utils";
import { ElevationLayer } from "./map.elevation.layer";
import { EventState, PropertyChangedEventArgs } from "core/events";
import { Bearing, IGeo2 } from "core/geography";

export class ElevationHost extends TileMapLayerView<IDemInfos> implements IElevationHost {
    public static TemplateNameSuffix = "grid";
    public static RootNameSuffix = "root";

    // the grid model
    _grid: Mesh;
    _tilesRoot: TransformNode;
    // cached cartesian center
    _cartesianCenter: Nullable<ICartesian2> = null;

    public constructor(layer: IElevationLayer, source: ITileView, scene?: Scene) {
        super(layer, source);
        this._tilesRoot = this._buildRoot(scene);
        this._grid = this._buildTemplate(scene);
        this.factory.withType(ElevationTile);

        this._applyExageration(layer.exageration ?? ElevationLayer.DefaultExageration);
    }

    public get root(): TransformNode {
        return this._tilesRoot;
    }

    protected _buildRoot(scene?: Scene): TransformNode {
        return new TransformNode(this._buildRootName(), scene);
    }

    protected _applyExageration(exageration: number, scale: number = 1.0) {
        this._tilesRoot.scaling.z = exageration * scale;
    }

    protected _applyPosition(x: number, y: number, z: number) {
        this._tilesRoot.position.set(x, y, z);
    }

    protected _onLayerPropertyChanged(eventData: PropertyChangedEventArgs<unknown, unknown>, eventState: EventState): void {
        // we survey the weight property of the layer to update the current view and messaging the map container that it need
        // to sort the layers again.
        if (IsElevationLayer(eventData.source)) {
            switch (eventData.propertyName) {
                case ElevationLayer.ExagerationPropertyName: {
                    this._applyExageration(<number>eventData.newValue ?? ElevationLayer.DefaultExageration);
                    break;
                }
                case ElevationLayer.InsetsPropertyName: {
                    const insets = eventData.source.insets;
                    if (insets) {
                        this._applyPosition(insets.x, insets.y, insets.z);
                    }
                    break;
                }
            }
        }
        super._onLayerPropertyChanged(eventData, eventState);
    }

    protected _onNavigationPropertyChanged(event: PropertyChangedEventArgs<ITileNavigationState, unknown>, state: EventState): void {
        switch (event.propertyName) {
            case "center": {
                const geo = event.newValue as IGeo2;
                this._cartesianCenter = this.metrics.getLatLonToPointXY(geo.lat, geo.lon, event.source.lod);
                this._onCenterChanged(this._cartesianCenter);
                break;
            }
            case "zoom": {
                const geo = event.source.center;
                this._cartesianCenter = this.metrics.getLatLonToPointXY(geo.lat, geo.lon, event.source.lod);
                this._onCenterChanged(this._cartesianCenter);
                this._onZoomChanged(event.source.scale);
                break;
            }
            case "azimuth": {
                this._onAzimuthChanged(event.newValue as Bearing);
                break;
            }
        }
    }

    public get exageration(): number {
        const l = this.layer;
        if (IsElevationLayer(l)) {
            return l.exageration ?? ElevationLayer.DefaultExageration;
        }
        return ElevationLayer.DefaultExageration;
    }

    protected _onZoomChanged(scale: number, exageration: number = ElevationLayer.DefaultExageration): void {
        this._tilesRoot.scaling.x = this._tilesRoot.scaling.y = scale;
        this._applyExageration(exageration, scale);
    }

    protected _onAzimuthChanged(azimuth: Bearing): void {
        this._tilesRoot.rotation.z = azimuth.radian;
    }

    protected _onCenterChanged(center: Nullable<ICartesian2>): void {
        if (center) {
            const tiles = this._activTiles;
            if (!tiles || !tiles.count) {
                return;
            }
            for (const tile of tiles) {
                this._setTilePosition(tile, center);
            }
        }
    }

    protected _buildTemplate(scene?: Scene) {
        const mesh = this._buildMesh(this._buildTemplateName() ?? this.name, scene);
        const gridFactory = this._buildGridFactory() ?? this._buildGridFactoryInternal();
        const grid = gridFactory.buildTopology(this.metrics.tileSize);
        if (grid instanceof VertexData) {
            grid.applyToMesh(mesh);
        } else {
            const data = new VertexData();
            data.indices = grid.indices;
            data.normals = grid.normals;
            data.positions = grid.positions;
            data.uvs = grid.uvs;
            data.applyToMesh(mesh);
        }
        return mesh;
    }

    protected _buildMesh(name: string, scene?: Scene): Mesh {
        const mesh = new Mesh(name, scene);
        return mesh;
    }

    protected _buildGridFactory(): ElevationGridFactory {
        return this._buildGridFactoryInternal();
    }

    protected _buildQualifiedName(n: string): string {
        if (this.namespace) {
            return `${this.namespace}_${n}`;
        }
        return n;
    }

    protected _buildTemplateName(): string {
        return this._buildQualifiedName(`${this.name}_${ElevationHost.TemplateNameSuffix}`);
    }

    protected _buildRootName(): string {
        return this._buildQualifiedName(`${this.name}_${ElevationHost.RootNameSuffix}`);
    }

    private _buildGridFactoryInternal(): ElevationGridFactory {
        return new ElevationGridFactory();
    }

    /**
     * this is the place where we gona build the instance of the templates. Depending the content of the tile,
     * the instance will be disabled if the content is not yet ready.
     * @param tiles an array of tiles or a tile
     */
    protected _onTilesAdded(tiles: ElevationTile | Array<ElevationTile>): void {
        if (Array.isArray(tiles)) {
            for (const t of tiles) {
                this._onTileAdded(t);
            }
        } else {
            this._onTileAdded(tiles);
        }
    }

    protected _onTilesRemoved(tiles: ElevationTile | Array<ElevationTile>): void {
        if (Array.isArray(tiles)) {
            for (const t of tiles) {
                this._onTileRemoved(t);
            }
        } else {
            this._onTileRemoved(tiles);
        }
    }

    protected _onTilesUpdated(tiles: ElevationTile | Array<ElevationTile>): void {
        if (Array.isArray(tiles)) {
            for (const t of tiles) {
                this._onTileUpdated(t);
            }
        } else {
            this._onTileUpdated(tiles);
        }
    }

    protected _onTileAdded(tile: ElevationTile): void {
        const m = this._createInstance(tile);
        if (m) {
            tile.surface = m;
            if (!tile.content) {
                m.setEnabled(false);
            }
            m.setParent(this.root);
            // this is theorically not possible to reach this point with a null _cartesianCenter, because
            // the navigation MUST be done in order to trigger tile loading.
            Assert(this._cartesianCenter != null, "Invalid state on Elevation host: center MUST be set.");
            this._setTilePosition(tile, this._cartesianCenter);
        }
    }

    protected _onTileRemoved(tile: ElevationTile): void {
        if (tile.surface) {
            tile.surface.dispose();
            tile.surface = null;
        }
    }

    protected _onTileUpdated(tile: ElevationTile): void {
        if (tile.surface && !tile.surface.isEnabled) {
            tile.surface.setEnabled(true);
        }
    }

    protected _createInstance(tile: ElevationTile): AbstractMesh {
        const instance = this._grid.createInstance(tile.quadkey);
        // at this point, the dimension should be in meters.
        // the tile size is actually unitless and normalized to one.
        // it represents usually 256 or 512, units in the display space.
        instance.scaling.x = instance.scaling.y = this.metrics.tileSize;
        instance.scaling.z = 1.0; // exageration is hold by the tiles root scaling.
        return instance;
    }

    protected _setActivTilePositions(center: ICartesian2) {
        for (const t of this._activTiles) {
            this._setTilePosition(t as IElevationTile, center);
        }
    }

    protected _setTilePosition(tile: IElevationTile, center: ICartesian2): void {
        if (tile?.bounds && tile?.surface) {
            const c = tile.bounds.center;
            const s = tile.surface;
            const x = c.x - center.x;
            const y = c.y - center.y;
            const p = s.position;
            // the tile system is origin north-west corner, y pointing to the south, x to the east.
            // our choice is to have the origin at the center of the tile, y pointing to the north, x to the west (this make z up into babylonjs coordinate system)
            // so the minus sign comes from that.
            p.x = -x;
            p.y = -y;
            p.z = 0;
        }
    }
}
