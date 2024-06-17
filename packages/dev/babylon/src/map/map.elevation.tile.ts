import { AbstractMesh } from "@babylonjs/core";
import { IDemInfos, IsDemInfos } from "core/dem";
import { ISourceBlock, ITile, ITileMetrics, Tile } from "core/tiles";
import { Nullable, isValidable } from "core/types";
import { CanvasTileSourceTargetContentType } from "core/map/canvas/map.canvas.source";

export interface IElevationMesh {
    // the original dem infos
    infos: Nullable<IDemInfos>;
    // the mesh used to display the elevation ()
    surface: Nullable<AbstractMesh>;
    // the texture used to display onto the elevation mesh
    textureSource: Nullable<ISourceBlock<ITile<CanvasTileSourceTargetContentType>>>;
    tile: Nullable<ITile<ImageData>>;
    validate(): void;
}

export interface IElevationTile extends ITile<IElevationMesh> {}

export class ElevationMesh implements IElevationMesh {
    // elevations related
    _demInfos: Nullable<IDemInfos>;
    _surface: Nullable<AbstractMesh>;

    // texture related
    _tile: Nullable<ITile<ImageData>>;
    _texture: Nullable<ISourceBlock<ITile<CanvasTileSourceTargetContentType>>>;

    public constructor(
        demInfos: Nullable<IDemInfos> = null,
        texture: Nullable<ISourceBlock<ITile<CanvasTileSourceTargetContentType>>> = null,
        tile: Nullable<ITile<ImageData>> = null,
        surface: Nullable<AbstractMesh> = null
    ) {
        this._demInfos = demInfos;
        this._texture = texture;
        this._surface = surface;
        this._tile = tile;
    }

    public get surface(): Nullable<AbstractMesh> {
        return this._surface;
    }

    public set surface(value: Nullable<AbstractMesh>) {
        this._surface = value;
    }

    public get tile(): Nullable<ITile<ImageData>> {
        return this._tile;
    }

    public set tile(value: Nullable<ITile<ImageData>>) {
        this._tile = value;
    }

    public get textureSource(): Nullable<ISourceBlock<ITile<CanvasTileSourceTargetContentType>>> {
        return this._texture;
    }

    public set textureSource(value: Nullable<ISourceBlock<ITile<CanvasTileSourceTargetContentType>>>) {
        this._texture = value;
    }

    public get infos(): Nullable<IDemInfos> {
        return this._demInfos;
    }

    public set infos(value: Nullable<IDemInfos>) {
        this._demInfos = value;
    }

    public validate(): void {
        const t = this._texture;
        if (isValidable(t)) {
            t.validate();
        }
    }
}

/// <summary>
/// A tile for elevation data. The tile serve as host for elevation data and therefore the instanced mesh used to display the elevation.
/// </summary>
export class ElevationTile extends Tile<IElevationMesh> implements IElevationTile {
    public constructor(x: number, y: number, lod: number, mesh: Nullable<IElevationMesh | IDemInfos>, metrics?: ITileMetrics) {
        if (IsDemInfos(mesh)) {
            mesh = new ElevationMesh(mesh);
        }
        super(x, y, lod, mesh ?? new ElevationMesh(), metrics);
    }
}
