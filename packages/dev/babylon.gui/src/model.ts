import { Observable } from "@babylonjs/core";
import { PropertyChangedEventArgs } from "core/events/events.args";

export interface IModel {
    name?: string;
    propertyChangedObservable: Observable<PropertyChangedEventArgs<IModel, any>>;
}

export class Model {
    private _name: string;
    private _propertyChangedObservable?: Observable<PropertyChangedEventArgs<Model, any>>;

    public constructor(name?: string) {
        this._name = name || this.constructor.name;
    }

    public get name(): string {
        return this._name;
    }

    public get propertyChangedObservable(): Observable<PropertyChangedEventArgs<Model, any>> {
        if (!this._propertyChangedObservable) {
            this._propertyChangedObservable = new Observable<PropertyChangedEventArgs<Model, any>>();
        }
        return this._propertyChangedObservable;
    }

    protected _firePropertyChanged(propertyName: string, oldValue?: any, newValue?: any): void {
        if (this._propertyChangedObservable && this._propertyChangedObservable.hasObservers()) {
            this._propertyChangedObservable.notifyObservers(new PropertyChangedEventArgs(this, oldValue, newValue, propertyName));
        }
    }
}
