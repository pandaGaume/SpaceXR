import { Observable } from "@babylonjs/core";

export class PropertyChangedEventArgs {
    private _propertyName: string;
    private _oldValue?: any;
    private _newValue?: any;
    private _source: any;

    public constructor(source: any, propertyName: string, oldValue?: any, newValue?: any) {
        this._propertyName = propertyName;
        this._oldValue = oldValue;
        this._newValue = newValue;
        this._source = source;
    }

    public get propertyName(): string {
        return this._propertyName;
    }

    public get oldValue(): any {
        return this._oldValue;
    }

    public get newValue(): any {
        return this._newValue;
    }

    public get source(): any {
        return this._source;
    }
}

export interface IModel {
    name?: string;
    propertyChangedObservable: Observable<PropertyChangedEventArgs>;
}

export class Model {
    private _name: string;
    private _propertyChangedObservable?: Observable<PropertyChangedEventArgs>;

    public constructor(name?: string) {
        this._name = name || this.constructor.name;
    }

    public get name(): string {
        return this._name;
    }

    public get propertyChangedObservable(): Observable<PropertyChangedEventArgs> {
        if (!this._propertyChangedObservable) {
            this._propertyChangedObservable = new Observable<PropertyChangedEventArgs>();
        }
        return this._propertyChangedObservable;
    }

    protected _firePropertyChanged(propertyName: string, oldValue?: any, newValue?: any): void {
        if (this._propertyChangedObservable && this._propertyChangedObservable.hasObservers()) {
            this._propertyChangedObservable.notifyObservers(new PropertyChangedEventArgs(this, propertyName, oldValue, newValue));
        }
    }
}
