import { Observable } from "@babylonjs/core";
export declare class PropertyChangedEventArgs {
    private _propertyName;
    private _oldValue?;
    private _newValue?;
    private _source;
    constructor(source: any, propertyName: string, oldValue?: any, newValue?: any);
    get propertyName(): string;
    get oldValue(): any;
    get newValue(): any;
    get source(): any;
}
export interface IModel {
    name?: string;
    propertyChangedObservable: Observable<PropertyChangedEventArgs>;
}
export declare class Model {
    private _name;
    private _propertyChangedObservable?;
    constructor(name?: string);
    get name(): string;
    get propertyChangedObservable(): Observable<PropertyChangedEventArgs>;
    protected _firePropertyChanged(propertyName: string, oldValue?: any, newValue?: any): void;
}
