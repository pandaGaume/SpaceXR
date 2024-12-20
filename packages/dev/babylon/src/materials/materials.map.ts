import {
    AbstractMesh,
    Effect,
    EffectFallbacks,
    IEffectCreationOptions,
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

export interface IMap3dMaterial {}

export class Map3dMaterial extends PushMaterial implements IMap3dMaterial {
    public static DefaultShaderName: string = "map";

    public static ViewProjectionMatrixUniformName: string = "viewProjection";

    // the name of the shader used by the material
    protected _shaderName: Nullable<string> = null;

    public constructor(name: string, scene?: Scene, shaderName?: string) {
        super(name, scene);
        this._shaderName = shaderName ?? Map3dMaterial.DefaultShaderName;
    }

    public getClassName(): string {
        return "Map3dMaterial";
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
        }
    }

    protected _bindMatrix(effect: Effect, world: Matrix, scene: Scene): void {
        effect.setMatrix(Map3dMaterial.ViewProjectionMatrixUniformName, scene.getTransformMatrix());
    }

    public dispose(forceDisposeEffect?: boolean): void {
        super.dispose(forceDisposeEffect);
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
