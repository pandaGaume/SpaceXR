import { IDisposable, Nullable, Observer, PointerInfo, Scene, Vector2, Vector3 } from "@babylonjs/core";
import { VirtualDisplay } from "./display.virtual";
export declare class VirtualDisplayInputsControllers implements IDisposable {
    _display: VirtualDisplay;
    _scenePointerObserver: Nullable<Observer<PointerInfo>>;
    _currentPosition: Nullable<Vector2>;
    constructor(display: VirtualDisplay);
    get display(): VirtualDisplay;
    dispose(): void;
    private onPointerEvent;
    private _onPointerDown;
    private _onPointerUp;
    private _onPointerMove;
    protected _getDisplayPosition(): Nullable<Vector3>;
    protected _pickFilter(mesh: Nullable<any>): boolean;
    protected _getScene(): Scene;
}
