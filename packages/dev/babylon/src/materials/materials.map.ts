import {
    AbstractMesh,
    Constants,
    Effect,
    EffectFallbacks,
    IEffectCreationOptions,
    InstancedMesh,
    Material,
    MaterialDefines,
    MaterialHelper,
    Matrix,
    Mesh,
    Nullable,
    PushMaterial,
    Scene,
    SubMesh,
    Vector2,
    Vector3,
    Vector4,
    VertexBuffer,
} from "@babylonjs/core";
import { ClipIndex, ClipPlaneDefinition, IHolographicBounds, IsHolographicBox, IsHolographicCylinder, IsHolographicSphere } from "../display";
import { Observer } from "core/events";
import { IElevationHost, IElevationTile, IMap3dMaterial } from "../map/elevations";
import { ITexture3Layer, Texture3 } from "./textures";
import { IsTileMetricsProvider, NeighborsAddress, TileAddress } from "core/tiles";
import { ICartesian3, ISize3, Size3 } from "core/geometry";
import { Range } from "core/math";
import { ElevationBuffer, ElevationHelpers, IDemInfos } from "core/dem";

class AreaInfos {
    layer: ITexture3Layer;
    public constructor(layer: ITexture3Layer) {
        this.layer = layer;
    }
}

export enum Map3dLayerKind {
    ELEVATION = 0,
    NORMAL = 1,
    UV = 2,
    ID = 3,
    TEXTURE = 4,
}

// internal class used to hold the tile pool texture areas
class TileLayout {
    public constructor(public tile: IElevationTile, public areas: Array<Nullable<AreaInfos>> = [null, null, null, null, null]) {}

    getArea(kind: Map3dLayerKind): Nullable<AreaInfos> {
        return this.areas[kind];
    }

    setArea(kind: Map3dLayerKind, value: Nullable<AreaInfos>): void {
        this.areas[kind] = value;
    }
}

export class Map3dMaterial extends PushMaterial implements IMap3dMaterial {
    public static DefaultElevationTextureDepth: number = 16;

    public static DefaultShaderName: string = "map";

    public static SamplerDepthsAttName: string = "depths";
    public static SamplerDepthsSize = 4;

    public static ViewProjectionMatrixUniformName: string = "viewProjection";

    // clip planes uniforms in case of holographic box
    public static NorthClipPlaneUniformName: string = "uNorthClip";
    public static SouthClipPlaneUniformName: string = "uSouthClip";
    public static EastClipPlaneUniformName: string = "uEastClip";
    public static WestClipPlaneUniformName: string = "uWestClip";

    // radius and height for holographic sphere and cylinder
    public static RadiusUniformName: string = "uRadiusClip";
    public static HeightUniformName: string = "uHeightClip";

    // altitude range and map scale for the material
    public static AltRangeUniformName: string = "uAltRange";
    public static MapScaleUniformName: string = "uMapScale";

    // Samplers for the material
    public static ElevationSamplerUniformName: string = "uAltitudes";
    public static NormalSamplerUniformName: string = "uNormals";
    public static SurfaceIdSamplerUniformName: string = "uSurfaceIds";
    public static SurfaceUVSamplerUniformName: string = "uSurfaceUvs";

    // the name of the shader used by the material
    protected _shaderName: Nullable<string> = null;

    // the optional holographix box where the material is used
    private _holoBounds: Nullable<IHolographicBounds> = null;
    // the observers for the holographic box clip planes
    private _clipPlanesAddedObservers: Nullable<Observer<Array<ClipPlaneDefinition>>> = null;
    private _clipPlanesRemovedObservers: Nullable<Observer<Array<ClipPlaneDefinition>>> = null;

    private _elevationSampler: Nullable<Texture3> = null;
    private _normalSampler: Nullable<Texture3> = null;
    private _surfaceUVSampler: Nullable<Texture3> = null;
    private _surfaceIDSampler: Nullable<Texture3> = null;

    // the elevation related properties.
    private _elevationRange: Nullable<Range> = null;
    private _mapScale: ICartesian3 = Vector3.One();

    // the layout and meta properties of each tiles
    protected _tileLayouts: Map<string, TileLayout> = new Map<string, TileLayout>();

    // the resolution of the display
    private _displayResolution: ISize3 = Size3.Zero();

    public constructor(name: string, scene?: Scene, shaderName?: string) {
        super(name, scene);
        this._shaderName = shaderName ?? Map3dMaterial.DefaultShaderName;
    }

    public getClassName(): string {
        return "Map3dMaterial";
    }

    public get holographicBounds(): Nullable<IHolographicBounds> {
        return this._holoBounds;
    }

    public set holographicBounds(value: Nullable<IHolographicBounds>) {
        if (this._holoBounds !== value) {
            this._unbindHolographicBounds();
            this._holoBounds = value;
            this._bindHolographicBounds();
            this.markAsDirty(Material.AttributesDirtyFlag);
        }
    }

    public get displayResolution(): ISize3 {
        return this._displayResolution;
    }

    public set displayResolution(value: ISize3) {
        if (this._displayResolution !== value) {
            this._displayResolution = value;
            this.markAsDirty(Material.AttributesDirtyFlag);
        }
    }

    public get mapScale(): ICartesian3 {
        return this._mapScale;
    }

    public set mapScale(value: ICartesian3) {
        if (this._mapScale !== value) {
            this._mapScale = value;
            this.markAsDirty(Material.AttributesDirtyFlag);
        }
    }

    public isReadyForSubMesh(mesh: AbstractMesh, subMesh: SubMesh, useInstances?: boolean): boolean {
        const drawWrapper = subMesh._drawWrapper;

        if (this.isFrozen) {
            if (drawWrapper.effect && drawWrapper._wasPreviouslyReady && drawWrapper._wasPreviouslyUsingInstances === useInstances) {
                return true;
            }
        }

        const defines: MaterialDefines = new MaterialDefines();
        const scene = this.getScene();

        if (this._isReadyForSubMesh(subMesh)) {
            return true;
        }

        const attribs = [
            // babylon related
            VertexBuffer.PositionKind,
            VertexBuffer.UVKind,

            // instance related
            Map3dMaterial.SamplerDepthsAttName,
        ];

        const uniforms = [
            // babylon related
            Map3dMaterial.ViewProjectionMatrixUniformName,
            // elevations
            Map3dMaterial.AltRangeUniformName,
            Map3dMaterial.MapScaleUniformName,
        ];

        const samplers = [
            Map3dMaterial.ElevationSamplerUniformName,
            Map3dMaterial.NormalSamplerUniformName,
            Map3dMaterial.SurfaceIdSamplerUniformName,
            Map3dMaterial.SurfaceUVSamplerUniformName,
        ];
        const uniformBuffers = new Array<string>();

        if (this._holoBounds) {
            this._pushUniformsForBounds(defines, uniforms);
        }

        // we heavily rely on instances
        defines.INSTANCES = true;
        MaterialHelper.PushAttributesForInstances(attribs);
        defines.rebuild();

        const fallbacks = new EffectFallbacks();
        const engine = scene.getEngine();

        subMesh.setEffect(
            engine.createEffect(
                this._shaderName,
                <IEffectCreationOptions>{
                    attributes: attribs,
                    uniformsNames: uniforms,
                    uniformBuffersNames: uniformBuffers,
                    samplers: samplers,
                    defines: defines.toString(),
                    fallbacks: fallbacks,
                    onCompiled: this._onEffectCompiled.bind(this),
                    onError: this.onError,
                },
                engine
            ),
            defines,
            this._materialContext
        );

        if (!subMesh.effect || !subMesh.effect.isReady()) {
            return false;
        }

        defines._renderId = scene.getRenderId();
        drawWrapper._wasPreviouslyReady = true;
        drawWrapper._wasPreviouslyUsingInstances = !!useInstances;

        return true;
    }

    public bindForSubMesh(world: Matrix, mesh: Mesh, subMesh: SubMesh): void {
        const defines = subMesh.materialDefines;
        if (!defines) {
            return;
        }

        const effect = subMesh.effect;
        if (!effect) {
            return;
        }
        this._activeEffect = effect;
        const scene = this.getScene();

        // Matrices
        this._bindMatrix(effect, world, scene);

        if (this._mustRebind(scene, effect, subMesh)) {
            // Clip planes
            this._bindClipPlanes(effect);
            // samplers
            this._bindSamplers(effect);
            // Elevations.
            this._bindElevations(effect);
        }
    }

    public addTile(tile: IElevationTile, source?: IElevationHost): void {
        // ensure elevation sampler is ready
        // this is done only once for the material
        if (source && IsTileMetricsProvider(source)) {
            this._ensureElevationSamplersReady(tile, source);
        }
        const key = tile.address.quadkey;
        let layout = this._tileLayouts.get(key);
        if (layout) {
            return;
        }
        const surface = tile.surface;
        if (!surface) {
            return;
        }

        // prepare the mesh.
        surface.instancedBuffers.depths = new Vector4(-1, -1, -1, -1);

        // prepare the elevation sampler.
        let elevationArea = this._reserveArea(this._elevationSampler, "Elevation sampler is full");
        if (elevationArea === undefined) {
            return;
        }

        // prepare the normal sampler.
        let normalArea = this._reserveArea(this._normalSampler, "Normal sampler is full");
        if (normalArea === undefined) {
            elevationArea.release();
            return;
        }

        const depthsAtt = surface?.instancedBuffers.depths;
        if (depthsAtt) {
            depthsAtt.x = elevationArea.depth;
            depthsAtt.y = normalArea.depth;
        }

        // Build the layout for the tile
        layout = new TileLayout(tile);
        this._tileLayouts.set(tile.address.quadkey, layout);
        // ELEVATION
        let areaInfos = new AreaInfos(elevationArea);
        layout.setArea(Map3dLayerKind.ELEVATION, areaInfos);
        if (tile.content?.elevations) {
            this._updateElevationRange(tile.content);
            this._updateElevationSampler(tile, areaInfos.layer, Map3dLayerKind.ELEVATION, (t) => t.content?.elevations);
            layout.tile.surface?.setEnabled(true);
            this.markAsDirty(Material.TextureDirtyFlag);
        }
        // NORMAL
        areaInfos = new AreaInfos(normalArea);
        layout.setArea(Map3dLayerKind.NORMAL, areaInfos);
    }

    public removeTile(tile: IElevationTile, source: IElevationHost): void {
        const key = tile.address.quadkey;
        const layout = this._tileLayouts.get(key);
        if (layout) {
            layout.getArea(Map3dLayerKind.ELEVATION)?.layer.release();
            layout.getArea(Map3dLayerKind.NORMAL)?.layer.release();
            this._tileLayouts.delete(key);
            this._elevationRange = null; // invalidate the elevation range
            this.markAsDirty(Material.TextureDirtyFlag);
        }
    }

    public updateTile(tile: IElevationTile, source: IElevationHost): void {
        // this happens when the tile content is set or updated
        const layout = this._tileLayouts.get(tile.address.quadkey);
        if (layout) {
            // bind the depth to the instance buffer if was not previously setted
            const surface = tile.surface;
            if (surface) {
                const d = layout.getArea(Map3dLayerKind.ELEVATION)?.layer.depth;
                surface.instancedBuffers.depths = new Vector4(d, -1, -1, -1);
            }

            if (tile.content?.elevations) {
                // we update the elevation range
                const areaInfos = layout.getArea(Map3dLayerKind.ELEVATION);
                if (areaInfos) {
                    // if not done during the add, it's update the sampler, which mean set the texture data.
                    // this is the place where the data are copied from the tile content to the sampler
                    // and the border are fileld with values related to the neibourghs tiles.
                    this._updateElevationRange(tile.content);
                    this._updateElevationSampler(tile, areaInfos.layer, Map3dLayerKind.ELEVATION, (t) => t.content?.elevations);
                    layout.tile.surface?.setEnabled(true);
                    this.markAsDirty(Material.TextureDirtyFlag);
                }
            }
        }
    }

    public dispose(forceDisposeEffect?: boolean): void {
        super.dispose(forceDisposeEffect);
        this._elevationSampler?.dispose();
    }

    protected _reserveArea(sampler: Nullable<Texture3>, mess?: string): ITexture3Layer | undefined {
        if (!sampler) {
            return undefined;
        }

        let area = sampler.reserve();
        if (!area) {
            if (mess) {
                console.log(mess);
            }
            // this is the place where we need to reallocate some depth into the samplers
            sampler.ensureRoomFor(1);
            area = sampler.reserve();
        }
        return area;
    }

    protected _updateElevationSampler(
        tile: IElevationTile,
        textureLayer: ITexture3Layer,
        kind: Map3dLayerKind,
        accessor: (tile: IElevationTile) => Nullable<ElevationBuffer> | undefined
    ) {
        const buffer = accessor(tile);
        if (buffer) {
            let w = textureLayer.host?.width ?? 0;
            let h = textureLayer.host?.height ?? 0;

            if (w && h) {
                w--;
                h--;
                // update the main area
                textureLayer.update(buffer, 0, 0, w, h);

                const quadkey = tile.address.quadkey;
                const keys = TileAddress.ToNeigborsKey(quadkey);

                // checking the north-west neigbour
                let k = keys[NeighborsAddress.NW];
                let layout;
                if (k) {
                    layout = this._tileLayouts.get(k);
                    if (layout) {
                        const area = layout.getArea(kind);
                        if (area) {
                            // we update the last value of the last row of the north-west neigbour with the first value of the firt row of the current tile
                            const v = ElevationHelpers.GetElevationAt(buffer, w, h, 0, 0);
                            area.layer.update(v, w, h, 1, 1);
                        }
                    }
                }

                // checking the north neigbour
                k = keys[NeighborsAddress.N];

                if (k) {
                    layout = this._tileLayouts.get(k);
                    if (layout) {
                        const area = layout.getArea(kind);
                        if (area) {
                            // we update the last row of the north neigbour with the first row of the current tile
                            const firstRow = ElevationHelpers.GetFirstRow(buffer, w);
                            area.layer.update(firstRow, 0, h, w, 1);
                        }
                    }
                }

                // checking the east neigbour
                k = keys[NeighborsAddress.E];
                if (k) {
                    layout = this._tileLayouts.get(k);
                    if (layout) {
                        const data = accessor(layout.tile);
                        if (data) {
                            // we update the last column of the current tile with the value of the first column of the east neigbour
                            const firstColumn = ElevationHelpers.GetFirstColumn(data, w, h);
                            textureLayer.update(firstColumn, w, 0, 1, h);
                        } else {
                            // we duplicate the last column of the current tile
                            const lastColumn = ElevationHelpers.GetLastColumn(buffer, w, h);
                            textureLayer.update(lastColumn, w, 0, 1, h);
                        }
                    }
                }

                // checking the south-east neigbour
                k = keys[NeighborsAddress.SE];
                if (k) {
                    layout = this._tileLayouts.get(k);
                    if (layout) {
                        // we update the last value of the last row of the current tile with the first value of the first row of the south-east neigbour
                        const data = accessor(layout.tile);
                        if (data) {
                            const first = ElevationHelpers.GetElevationAt(data, w, h, 0, 0);
                            textureLayer.update(first, w, h, 1, 1);
                        } else {
                            // we duplicate the last value of the last row of the current tile
                            const last = ElevationHelpers.GetElevationAt(buffer, w, h, w - 1, h - 1);
                            textureLayer.update(last, w, h, 1, 1);
                        }
                    }
                }

                // checking the south neigbour
                k = keys[NeighborsAddress.S];
                if (k) {
                    layout = this._tileLayouts.get(k);
                    if (layout) {
                        // we update the last row of the current tile with the first row of the south neigbour
                        const data = accessor(layout.tile);
                        if (data) {
                            const firstRow = ElevationHelpers.GetFirstRow(data, w);
                            textureLayer.update(firstRow, 0, h, w, 1);
                        } else {
                            // we duplicate the last row of the current tile
                            const lastRow = ElevationHelpers.GetLastRow(buffer, w, h);
                            textureLayer.update(lastRow, 0, h, w, 1);
                        }
                    }
                }

                // checking the west neigbour
                k = keys[NeighborsAddress.W];
                if (k) {
                    layout = this._tileLayouts.get(k);
                    if (layout) {
                        const area = layout.getArea(kind);
                        if (area) {
                            // we update the last column of the  west neigbour with the first column of the current tile
                            const firstColumn = ElevationHelpers.GetFirstColumn(buffer, w, h);
                            area.layer.update(firstColumn, w, 0, 1, h);
                        }
                    }
                }
            }
        }
    }

    protected _getElevationRange(): Range {
        if (this._elevationRange === null) {
            this._elevationRange = this._buildElevationRange();
        }
        return this._elevationRange;
    }

    protected _buildElevationRange(): Range {
        let range: Nullable<Range> = null;
        for (let b of this._tileLayouts.values()) {
            const infos = b.tile.content;
            if (infos) {
                if (range === null) {
                    range = new Range(infos.min.z, infos.max.z);
                    continue;
                }
                range.unionInPlace(infos.min.z, infos.max.z);
            }
        }
        return range ?? new Range(Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER);
    }

    protected _updateElevationRange(infos: Nullable<IDemInfos>): void {
        if (infos) {
            this._getElevationRange().unionInPlace(infos.min.z, infos.max.z);
            this.markAsDirty(Material.AttributesDirtyFlag);
        }
    }

    protected _pushUniformsForBounds(defines: MaterialDefines, uniforms: Array<string>) {
        if (IsHolographicBox(this._holoBounds)) {
            defines.HOLOGRAPHIC_BOUNDS_BOX = true;
            const properties = ["point", "normal"];
            uniforms.push(
                // clip planes
                ...this._prepareUniforms(Map3dMaterial.NorthClipPlaneUniformName, ...properties),
                ...this._prepareUniforms(Map3dMaterial.SouthClipPlaneUniformName, ...properties),
                ...this._prepareUniforms(Map3dMaterial.EastClipPlaneUniformName, ...properties),
                ...this._prepareUniforms(Map3dMaterial.WestClipPlaneUniformName, ...properties)
            );
        } else if (IsHolographicSphere(this._holoBounds)) {
            throw new Error("Sphere bounds Not supported");
            defines.HOLOGRAPHIC_BOUNDS_SPHERE = true;
            uniforms.push(
                // sphere properties
                Map3dMaterial.RadiusUniformName
            );
        } else if (IsHolographicCylinder(this._holoBounds)) {
            throw new Error("Cylinder bounds Not supported");
            defines.HOLOGRAPHIC_BOUNDS_CYLINDER = true;
            uniforms.push(
                // cylinder properties
                Map3dMaterial.RadiusUniformName,
                Map3dMaterial.HeightUniformName
            );
        }
    }

    protected _onClipPlanesAdded(planes: Array<ClipPlaneDefinition>): void {
        this.markAsDirty(Material.AttributesDirtyFlag);
    }

    protected _onClipPlanesRemoved(planes: Array<ClipPlaneDefinition>): void {
        this.markAsDirty(Material.AttributesDirtyFlag);
    }

    protected _bindMatrix(effect: Effect, world: Matrix, scene: Scene): void {
        effect.setMatrix(Map3dMaterial.ViewProjectionMatrixUniformName, scene.getTransformMatrix());
    }

    protected _bindElevations(effect: Effect): void {
        const r = this._getElevationRange();
        effect.setVector2(Map3dMaterial.AltRangeUniformName, new Vector2(r.min, r.max));
        effect.setFloat(Map3dMaterial.MapScaleUniformName, this._mapScale.x);
    }

    protected _bindHolographicBounds(): void {
        if (this._holoBounds) {
            if (IsHolographicBox(this._holoBounds)) {
                this._clipPlanesAddedObservers = this._holoBounds.clipPlanesAddedObservable.add(this._onClipPlanesAdded.bind(this));
                this._clipPlanesRemovedObservers = this._holoBounds.clipPlanesRemovedObservable.add(this._onClipPlanesRemoved.bind(this));
            }
        }
    }

    protected _bindClipPlanes(effect: Effect): void {
        if (this._holoBounds) {
            if (IsHolographicBox(this._holoBounds)) {
                const clips = this._holoBounds.clipPlanesWorld;
                if (clips) {
                    this._bindClipPlane(effect, clips, Map3dMaterial.NorthClipPlaneUniformName, ClipIndex.North);
                    this._bindClipPlane(effect, clips, Map3dMaterial.SouthClipPlaneUniformName, ClipIndex.South);
                    this._bindClipPlane(effect, clips, Map3dMaterial.EastClipPlaneUniformName, ClipIndex.East);
                    this._bindClipPlane(effect, clips, Map3dMaterial.WestClipPlaneUniformName, ClipIndex.West);
                }
            } else if (IsHolographicSphere(this._holoBounds)) {
                effect.setFloat(Map3dMaterial.RadiusUniformName, this._holoBounds.radius);
            } else if (IsHolographicCylinder(this._holoBounds)) {
                effect.setFloat(Map3dMaterial.RadiusUniformName, this._holoBounds.radius);
                effect.setVector3(Map3dMaterial.HeightUniformName, this._holoBounds.height ?? new Vector3(0, Number.MAX_SAFE_INTEGER, 0));
            }
        }
    }

    protected _bindClipPlane(effect: Effect, planes: Array<ClipPlaneDefinition>, name: string, index: ClipIndex): void {
        let clipPlane = planes[index];
        if (clipPlane) {
            effect.setVector3(`${name}.point`, clipPlane.point);
            effect.setVector3(`${name}.normal`, clipPlane.normal);
        }
    }

    protected _bindSamplers(effect: Effect): void {
        effect.setTexture(Map3dMaterial.ElevationSamplerUniformName, this._elevationSampler);
        effect.setTexture(Map3dMaterial.NormalSamplerUniformName, this._normalSampler);
        effect.setTexture(Map3dMaterial.SurfaceIdSamplerUniformName, this._surfaceIDSampler);
        effect.setTexture(Map3dMaterial.SurfaceUVSamplerUniformName, this._surfaceUVSampler);
    }

    protected _unbindHolographicBounds(): void {
        if (this._holoBounds) {
            this._clipPlanesAddedObservers?.disconnect();
            this._clipPlanesRemovedObservers?.disconnect();
            this._clipPlanesAddedObservers = null;
            this._clipPlanesRemovedObservers = null;
            this.markAsDirty(Material.AttributesDirtyFlag);
        }
    }

    protected _prepareUniforms(name: string, ...properties: string[]): string[] {
        return properties.map((p) => `${name}.${p}`);
    }

    protected _onEffectCompiled(effect: Effect): void {
        // console.log("DEFINES:", effect.defines);
        // console.log("VERTEX:", effect.vertexSourceCode);
        // console.log("FRAGMENT:", effect.fragmentSourceCode);
        if (this.onCompiled) {
            this.onCompiled(effect);
        }
    }

    protected _buildElevationSampler(width: number, height?: number, depth?: number): void {
        height = height ?? width;
        const maxDepth = depth ?? this._getElevationSamplerDepth(width, height);
        const generateMipMap = false;
        const scene = this.getScene();
        this._elevationSampler = <Texture3>this._buildSampler(Map3dLayerKind.ELEVATION, width, height, maxDepth, generateMipMap, scene);
    }

    protected _buildNormalSampler(width: number, height?: number, depth?: number): void {
        height = height ?? width;
        const maxDepth = depth ?? this._getElevationSamplerDepth(width, height);
        const generateMipMap = false;
        const scene = this.getScene();
        this._normalSampler = <Texture3>this._buildSampler(Map3dLayerKind.NORMAL, width, height, maxDepth, generateMipMap, scene);
    }

    protected _buildSurfaceUVSampler(width: number, height?: number, depth?: number): void {
        height = height ?? width;
        const maxDepth = depth ?? this._getElevationSamplerDepth(width, height);
        const generateMipMap = false;
        const scene = this.getScene();
        this._surfaceUVSampler = <Texture3>this._buildSampler(Map3dLayerKind.UV, width, height, maxDepth, generateMipMap, scene);
    }

    protected _buildSurfaceIDSampler(width: number, height?: number, depth?: number): void {
        height = height ?? width;
        const maxDepth = depth ?? this._getElevationSamplerDepth(width, height);
        const generateMipMap = false;
        const scene = this.getScene();
        this._surfaceIDSampler = <Texture3>this._buildSampler(Map3dLayerKind.ID, width, height, maxDepth, generateMipMap, scene);
    }

    protected _buildSampler(kind: Map3dLayerKind, width: number, height: number, depth: number, generateMipMap: boolean, scene: Scene): Nullable<Texture3> {
        switch (kind) {
            case Map3dLayerKind.ELEVATION: {
                const options = {
                    width: width,
                    height: height,
                    depth: depth,
                    format: Constants.TEXTUREFORMAT_R,
                    textureType: Constants.TEXTURETYPE_FLOAT, // the input is Float32Array
                    samplingMode: Constants.TEXTURE_BILINEAR_SAMPLINGMODE,
                    internalFormat: scene.getEngine()._gl.R16F, // force internal format to save half space
                    generateMipMap: generateMipMap,
                };
                return new Texture3(scene, options);
            }
            case Map3dLayerKind.NORMAL: {
                const options = {
                    width: width,
                    height: height,
                    depth: depth,
                    format: Constants.TEXTUREFORMAT_RGB,
                    textureType: Constants.TEXTURETYPE_UNSIGNED_BYTE,
                    samplingMode: Constants.TEXTURE_BILINEAR_SAMPLINGMODE,
                    internalFormat: scene.getEngine()._gl.RGB8, // force internal format to save half space
                    generateMipMap: generateMipMap,
                };
                return new Texture3(scene, options);
            }
            case Map3dLayerKind.UV: {
                const options = {
                    width: width,
                    height: height,
                    depth: depth,
                    format: Constants.TEXTUREFORMAT_RG,
                    textureType: Constants.TEXTURETYPE_HALF_FLOAT, // the input is Float16Array
                    samplingMode: Constants.TEXTURE_BILINEAR_SAMPLINGMODE,
                    internalFormat: scene.getEngine()._gl.R16F, // force internal format to save half space
                    generateMipMap: generateMipMap,
                };
                return new Texture3(scene, options);
            }
            case Map3dLayerKind.ID: {
                const options = {
                    width: width,
                    height: height,
                    depth: depth,
                    format: Constants.TEXTUREFORMAT_R,
                    textureType: Constants.TEXTURETYPE_SHORT, // the input is Int16Array
                    samplingMode: Constants.TEXTURE_NEAREST_NEAREST,
                    internalFormat: scene.getEngine()._gl.R16I,
                    generateMipMap: generateMipMap,
                };
                return new Texture3(scene, options);
            }
            case Map3dLayerKind.TEXTURE: {
                const options = {
                    width: width,
                    height: height,
                    depth: depth,
                    format: Constants.TEXTUREFORMAT_RGB,
                    textureType: Constants.TEXTURETYPE_UNSIGNED_BYTE,
                    samplingMode: Constants.TEXTURE_BILINEAR_SAMPLINGMODE,
                    internalFormat: scene.getEngine()._gl.RGB8, // force internal format to save half space
                    generateMipMap: generateMipMap,
                };
                // this is where we leverage the Map3dTexture class to handle the layer texture
                return new Texture3(scene, options);
            }
            default: {
                return null;
            }
        }
    }

    protected _tryGetSize(tile: IElevationTile, src: any): number {
        let size = IsTileMetricsProvider(src) ? src.metrics.tileSize : 0;
        if (!size) {
            size = Math.sqrt(tile.content?.elevations?.length ?? 0);
        }
        return size;
    }

    protected _ensureElevationSamplersReady(tile: IElevationTile, src: IElevationHost): void {
        if (!this._elevationSampler) {
            let size = this._tryGetSize(tile, src);
            if (size) {
                // here we gona build the elevation sampler with a size of N+1 because we add a row at the bottom and a column on the right
                // to keep the definition of the grid which is N+1 x N+1
                this._buildElevationSampler(size + 1);
                this._buildNormalSampler(size + 1);
                this._buildSurfaceUVSampler(size + 1);
                this._buildSurfaceIDSampler(size + 1);
            }
            this._ensureInstanceBufferReady(src.grid);
        }
    }

    protected _ensureInstanceBufferReady(target: AbstractMesh): void {
        if (target) {
            const mesh = target instanceof InstancedMesh ? target.sourceMesh : (target as Mesh);
            if (mesh.instancedBuffers?.depth === undefined) {
                this._registerInstanceBuffers(mesh);
            }
        }
    }

    protected _registerInstanceBuffers(target: Mesh): void {
        target.registerInstancedBuffer(Map3dMaterial.SamplerDepthsAttName, Map3dMaterial.SamplerDepthsSize);
    }

    protected _getElevationSamplerDepth(width: number, height: number): number {
        if (Size3.IsEmpty(this._displayResolution)) {
            return Map3dMaterial.DefaultElevationTextureDepth; // we set a fixed number of tiles
        }

        // we calculate the number of tiles that can be displayed on the screen
        // using empiric formula based on surface, trying to minimize the number of tiles
        const a = this._displayResolution.width / width;
        const b = this._displayResolution.height / height;
        const N = Math.ceil(a * b + 2 * (a + b));
        return N;
    }

    /*    protected _growElevationSamplersDepth(): void {
        // this is the place we gonna grow the depth of the samplers
        // this may happen when we deal with multiple LOD, has we do not want to waste memory at setup time with a huge buffer
        const currentDepth = this._elevationSampler?.depth ?? 0;
        const newDepth = Math.ceil(currentDepth * 1.2);
        console.log(`Need to Grow elevation samplers depth from ${currentDepth} to ${newDepth}`);
        const width = this._elevationSampler?.width ?? 0;
        const height = this._elevationSampler?.height ?? 0;

        const existingTiles = Array.from(this._tileLayouts.values()).map((v) => v.tile);

        this._tileLayouts.clear();
        this._elevationSampler?.dispose();

        const generateMipMap = false;
        const scene = this.getScene();
        this._elevationSampler = <Texture3>this._buildSampler(Map3dLayerKind.ELEVATION, width, height, newDepth, generateMipMap, scene);

        for (let tile of existingTiles) {
            this.addTile(tile);
        }
    }*/
}
