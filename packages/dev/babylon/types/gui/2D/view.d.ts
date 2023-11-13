import { Observable } from "@babylonjs/core";
import { Container, StackPanel } from "@babylonjs/gui";
import { IModel, PropertyChangedEventArgs } from "../model";
import { IViewSkin } from "../skin";
export declare class View<T, S extends IViewSkin> extends Container implements IModel {
    static BuildPropertyBlock(name: string, iconUrl: string, value: string, key?: string, sep?: string): StackPanel;
    static UpdatePropertyBlock(block: StackPanel, name: string, iconUrl: string, value: string, key?: string, sep?: string): void;
    static ApplyStyleSheet(target: Container, styles?: any): void;
    private _model?;
    private _modelChangedObservable?;
    private _skinChangedObservable?;
    private _skin?;
    private _propertyChangedObservable?;
    constructor(name?: string, model?: T, skin?: S);
    get propertyChangedObservable(): Observable<PropertyChangedEventArgs>;
    get model(): T | undefined;
    set model(value: T | undefined);
    get skin(): S | undefined;
    set skin(value: S | undefined);
    get modelChangedObservable(): Observable<View<T, S>>;
    get skinChangedObservable(): Observable<View<T, S>>;
    protected _createContent(options?: any): void;
    protected _updateContent(oldValue: T | undefined, newValue: T | undefined): void;
    protected _updateSkin(oldValue: IViewSkin | undefined, newValue: IViewSkin | undefined): void;
    protected _onModelChanged(oldValue: T | undefined, newValue: T | undefined): void;
    protected _onSkinChanged(oldValue: IViewSkin | undefined, newValue: IViewSkin | undefined): void;
    protected _firePropertyChanged(propertyName: string, oldValue?: any, newValue?: any): void;
}
