import { Observable } from "@babylonjs/core";
import { Container, StackPanel, TextBlock, Image } from "@babylonjs/gui";

import { IModel } from "../model";
import { IViewSkin } from "../skin";
import { PropertyChangedEventArgs } from "core/events/events.args";

export class View<T, S extends IViewSkin> extends Container implements IModel {
    public static BuildPropertyBlock(name: string, iconUrl: string, value: string, key?: string, sep?: string): StackPanel {
        const block = new StackPanel(`${name}Property`);
        block.isVertical = false;
        if (iconUrl != null || iconUrl !== undefined) {
            const icon = new Image(`${name}Icon`, iconUrl);
            block.addControl(icon);
        }
        if (key != null || key !== undefined) {
            const txt = new TextBlock(`${name}Key`);
            txt.text = sep ? `${key}${sep}` : key;
            block.addControl(txt);
        }
        if (value != null || value !== undefined) {
            const txt = new TextBlock(`${name}Value`);
            txt.text = value;
            block.addControl(txt);
        }

        return block;
    }

    public static UpdatePropertyBlock(block: StackPanel, name: string, iconUrl: string, value: string, key?: string, sep?: string): void {
        if (iconUrl) {
            const icon = <Image>block.getChildByName(`${name}Icon`);
            if (icon) {
                icon.source = iconUrl;
            }
        }
        if (key) {
            const txt = <TextBlock>block.getChildByName(`${name}Key`);
            if (txt) {
                txt.text = sep ? `${key}${sep}` : key;
            }
        }
        if (value) {
            const txt = <TextBlock>block.getChildByName(`${name}Value`);
            if (txt) {
                txt.text = value;
            }
        }
    }

    public static ApplyStyleSheet(target: Container, styles?: any): void {
        if (styles) {
            for (const c of target.children) {
                if (c.name) {
                    const s = styles[c.name];
                    if (s) {
                        for (const k in s) {
                            // The in operator checks for the presence of a property in an object or its prototype chain.
                            if (k in c) {
                                // console.log(`Applying style ${k} = ${s[k]} to ${c.name}`);
                                try {
                                    (<any>c)[k] = s[k];
                                } catch {
                                    // do no let the error propagate
                                    console.error(`Error setting property ${k} = ${s[k]} on ${c.name}`);
                                }
                            }
                        }
                    }
                }
                if (c instanceof Container) {
                    View.ApplyStyleSheet(c, styles);
                }
            }
        }
    }

    private _model?: T;
    private _modelChangedObservable?: Observable<PropertyChangedEventArgs<View<T, S>, T>>;
    private _skinChangedObservable?: Observable<PropertyChangedEventArgs<View<T, S>, S>>;
    private _skin?: S;
    private _propertyChangedObservable?: Observable<PropertyChangedEventArgs<IModel, any>>;

    public constructor(name?: string, model?: T, skin?: S, options?: any) {
        super(name);
        this._createContent(model, skin, options);
        this.skin = skin;
        this.model = model;
    }

    public get propertyChangedObservable(): Observable<PropertyChangedEventArgs<IModel, any>> {
        if (!this._propertyChangedObservable) {
            this._propertyChangedObservable = new Observable<PropertyChangedEventArgs<IModel, any>>();
        }
        return this._propertyChangedObservable;
    }

    public get model(): T | undefined {
        return this._model;
    }

    public set model(value: T | undefined) {
        if (this._model !== value) {
            const old = this._model;
            this._model = value;
            this._updateContent(old, value);
            this._onModelChanged(old, value);
            if (this._modelChangedObservable && this._modelChangedObservable.hasObservers()) {
                this._modelChangedObservable.notifyObservers(new PropertyChangedEventArgs(this, old, this._model));
            }
        }
    }

    public get skin(): S | undefined {
        return this._skin;
    }

    public set skin(value: S | undefined) {
        const old = this._skin;
        this._skin = value;
        this._updateSkin(old, value);
        this._onSkinChanged(old, value);
        if (this._skinChangedObservable && this._skinChangedObservable.hasObservers()) {
            this._skinChangedObservable.notifyObservers(new PropertyChangedEventArgs(this, old, this._skin));
        }
    }

    public get modelChangedObservable(): Observable<PropertyChangedEventArgs<View<T, S>, T>> {
        if (!this._modelChangedObservable) {
            this._modelChangedObservable = new Observable<PropertyChangedEventArgs<View<T, S>, T>>();
        }
        return this._modelChangedObservable;
    }

    public get skinChangedObservable(): Observable<PropertyChangedEventArgs<View<T, S>, S>> {
        if (!this._skinChangedObservable) {
            this._skinChangedObservable = new Observable<PropertyChangedEventArgs<View<T, S>, S>>();
        }
        return this._skinChangedObservable;
    }

    protected _createContent(model?: T, skin?: S, options?: any): void {}

    protected _updateContent(oldValue: T | undefined, newValue: T | undefined): void {
        // nothing to do so far while there is no content
    }

    protected _updateSkin(oldValue: IViewSkin | undefined, newValue: IViewSkin | undefined): void {
        View.ApplyStyleSheet(this, newValue?.styles); // this apply the style sheet down the hierarchy
        this._updateContent(this._model, this._model); // this update the content  it could be impacted by styling
    }

    protected _onModelChanged(oldValue: T | undefined, newValue: T | undefined): void {}

    protected _onSkinChanged(oldValue: IViewSkin | undefined, newValue: IViewSkin | undefined): void {}

    protected _firePropertyChanged(propertyName: string, oldValue?: any, newValue?: any): void {
        if (this._propertyChangedObservable && this._propertyChangedObservable.hasObservers()) {
            this._propertyChangedObservable.notifyObservers(new PropertyChangedEventArgs(this, oldValue, newValue, propertyName));
        }
    }
}
