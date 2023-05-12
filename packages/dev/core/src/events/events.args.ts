export class EventArgs<S> {
    _source: S;
    public constructor(source: S) {
        this._source = source;
    }

    public get source(): S {
        return this._source;
    }
}

export class PropertyChangedEventArgs<S, V> extends EventArgs<S> {
    _o?: V;
    _v?: V;

    public constructor(source: S, oldValue?: V, newValue?: V) {
        super(source);
        this._o = oldValue;
        this._v = newValue;
    }

    public get oldValue(): V | undefined {
        return this._o;
    }

    public get value(): V | undefined {
        return this._v;
    }
}
