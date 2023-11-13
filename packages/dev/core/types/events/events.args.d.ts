export declare class EventArgs<S> {
    _source: S;
    constructor(source: S);
    get source(): S;
}
export declare class PropertyChangedEventArgs<S, T> extends EventArgs<S> {
    private _propertyName?;
    private _oldValue?;
    private _newValue?;
    constructor(source: S, oldValue?: T, newValue?: T, propertyName?: string);
    get propertyName(): string | undefined;
    get oldValue(): T | undefined;
    get newValue(): T | undefined;
    get source(): S;
}
