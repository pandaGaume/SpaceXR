export class EventArgs<S> {
    _source: S;
    public constructor(source: S) {
        this._source = source;
    }

    public get source(): S {
        return this._source;
    }
}

export class PropertyChangedEventArgs<S, T> extends EventArgs<S> {
    private _propertyName?: string;
    private _oldValue?: T;
    private _newValue?: T;

    public constructor(source: S, oldValue?: T, newValue?: T, propertyName?: string) {
        super(source);
        this._propertyName = propertyName;
        this._oldValue = oldValue;
        this._newValue = newValue;
    }

    public get propertyName(): string | undefined {
        return this._propertyName;
    }

    public get oldValue(): T | undefined {
        return this._oldValue;
    }

    public get newValue(): T | undefined {
        return this._newValue;
    }

    public get source(): S {
        return this._source;
    }
}
