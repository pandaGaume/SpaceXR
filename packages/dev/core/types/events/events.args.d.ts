export declare class EventArgs<S> {
    _source: S;
    constructor(source: S);
    get source(): S;
}
export declare class PropertyChangedEventArgs<S, V> extends EventArgs<S> {
    _o?: V;
    _v?: V;
    constructor(source: S, oldValue?: V, newValue?: V);
    get oldValue(): V | undefined;
    get value(): V | undefined;
}
