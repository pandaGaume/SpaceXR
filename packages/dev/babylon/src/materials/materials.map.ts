import {
    AbstractMesh,
    Effect,
    EffectFallbacks,
    IEffectCreationOptions,
    Material,
    MaterialDefines,
    MaterialHelper,
    Matrix,
    Mesh,
    Nullable,
    PushMaterial,
    Scene,
    SubMesh,
    VertexBuffer,
} from "@babylonjs/core";
import { ClipIndex, ClipPlaneDefinition, IHolographicBox } from "../display";
import { Observer } from "core/events";

export interface IMap3dMaterial {}

export class Map3dMaterial extends PushMaterial implements IMap3dMaterial {
    public static DefaultShaderName: string = "map";

    public static ViewProjectionMatrixUniformName: string = "viewProjection";
    public static NorthClipPlaneUniformName: string = "uNorthClip";
    public static SouthClipPlaneUniformName: string = "uSouthClip";
    public static EastClipPlaneUniformName: string = "uEastClip";
    public static WestClipPlaneUniformName: string = "uWestClip";

    // the name of the shader used by the material
    protected _shaderName: Nullable<string> = null;

    // the optional holographix box where the material is used
    private _holoBounds: Nullable<IHolographicBox> = null;
    // the observers for the holographic box clip planes
    private _clipPlanesAddedObservers: Nullable<Observer<Array<ClipPlaneDefinition>>> = null;
    private _clipPlanesRemovedObservers: Nullable<Observer<Array<ClipPlaneDefinition>>> = null;

    public constructor(name: string, scene?: Scene, shaderName?: string) {
        super(name, scene);
        this._shaderName = shaderName ?? Map3dMaterial.DefaultShaderName;
    }

    public getClassName(): string {
        return "Map3dMaterial";
    }

    public get holographicBox(): Nullable<IHolographicBox> {
        return this._holoBounds;
    }

    public set holographicBox(value: Nullable<IHolographicBox>) {
        if (this._holoBounds !== value) {
            if (this._holoBounds) {
                this._clipPlanesAddedObservers?.disconnect();
                this._clipPlanesRemovedObservers?.disconnect();
                this._clipPlanesAddedObservers = null;
                this._clipPlanesRemovedObservers = null;
            }
            this._holoBounds = value;

            if (this._holoBounds) {
                this._clipPlanesAddedObservers = this._holoBounds.clipPlanesAddedObservable.add(this._onClipPlanesAdded.bind(this));
                this._clipPlanesRemovedObservers = this._holoBounds.clipPlanesRemovedObservable.add(this._onClipPlanesRemoved.bind(this));
            }

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
        ];

        const uniforms = [
            // babylon related
            Map3dMaterial.ViewProjectionMatrixUniformName,
        ];

        const samplers = new Array<string>();
        const uniformBuffers = new Array<string>();

        if (this._holoBounds) {
            defines.CLIP_PLANES = true;
            const properties = ["point", "normal"];
            uniforms.push(
                // clip planes
                ...this._prepareUniforms(Map3dMaterial.NorthClipPlaneUniformName, ...properties),
                ...this._prepareUniforms(Map3dMaterial.SouthClipPlaneUniformName, ...properties),
                ...this._prepareUniforms(Map3dMaterial.EastClipPlaneUniformName, ...properties),
                ...this._prepareUniforms(Map3dMaterial.WestClipPlaneUniformName, ...properties)
            );
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

    protected _bindClipPlanes(effect: Effect): void {
        if (this._holoBounds) {
            const clips = this._holoBounds.clipPlanesWorld;
            if (clips) {
                this._bindClipPlane(effect, clips, Map3dMaterial.NorthClipPlaneUniformName, ClipIndex.North);
                this._bindClipPlane(effect, clips, Map3dMaterial.SouthClipPlaneUniformName, ClipIndex.South);
                this._bindClipPlane(effect, clips, Map3dMaterial.EastClipPlaneUniformName, ClipIndex.East);
                this._bindClipPlane(effect, clips, Map3dMaterial.WestClipPlaneUniformName, ClipIndex.West);
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

    public dispose(forceDisposeEffect?: boolean): void {
        super.dispose(forceDisposeEffect);
    }

    protected _prepareUniforms(name: string, ...properties: string[]): string[] {
        return properties.map((p) => `${name}.${p}`);
    }

    protected _onEffectCompiled(effect: Effect): void {
        console.log("DEFINES:", effect.defines);
        console.log("VERTEX:", effect.vertexSourceCode);
        console.log("FRAGMENT:", effect.fragmentSourceCode);
        if (this.onCompiled) {
            this.onCompiled(effect);
        }
    }
}
