import { Observable } from "@babylonjs/core";
import { PropertyChangedEventArgs } from "core/events/events.args";
export interface IModel {
    name?: string;
    propertyChangedObservable: Observable<PropertyChangedEventArgs<IModel, any>>;
}
export declare class Model {
    private _name;
    private _propertyChangedObservable?;
    constructor(name?: string);
    get name(): string;
    get propertyChangedObservable(): Observable<PropertyChangedEventArgs<Model, any>>;
    protected _firePropertyChanged(propertyName: string, oldValue?: any, newValue?: any): void;
}
