import type { Nullable } from "../types";
export declare class EventState {
    constructor(mask: number, skipNextObservers?: boolean, target?: any, currentTarget?: any);
    initialize(mask: number, skipNextObservers?: boolean, target?: any, currentTarget?: any): EventState;
    skipNextObservers?: boolean;
    mask?: number;
    target?: any;
    currentTarget?: any;
    lastReturnValue?: any;
    userInfo?: any;
}
export declare class Observer<T> {
    source: Observable<T>;
    callback: (eventData: T, eventState: EventState) => void;
    mask: number;
    scope: any;
    _willBeUnregistered: boolean;
    unregisterOnNextCall: boolean;
    constructor(source: Observable<T>, callback: (eventData: T, eventState: EventState) => void, mask: number, scope?: any);
    disconnect(): void;
}
export declare class Observable<T> {
    private _observers;
    _eventState: EventState;
    private _onObserverAdded?;
    static FromPromise<T, E = Error>(promise: Promise<T>, onErrorObservable?: Observable<E>): Observable<T>;
    get observers(): Array<Observer<T>>;
    constructor(onObserverAdded?: (observer: Observer<T>) => void);
    add(callback: (eventData: T, eventState: EventState) => void, mask?: number, insertFirst?: boolean, scope?: any, unregisterOnFirstCall?: boolean): Nullable<Observer<T>>;
    addOnce(callback: (eventData: T, eventState: EventState) => void): Nullable<Observer<T>>;
    remove(observer: Nullable<Observer<T>>): boolean;
    removeCallback(callback: (eventData: T, eventState: EventState) => void, scope?: any): boolean;
    _deferUnregister(observer: Observer<T>): void;
    private _remove;
    makeObserverTopPriority(observer: Observer<T>): void;
    makeObserverBottomPriority(observer: Observer<T>): void;
    notifyObservers(eventData: T, mask?: number, target?: any, currentTarget?: any, userInfo?: any): boolean;
    notifyObserver(observer: Observer<T>, eventData: T, mask?: number): void;
    hasObservers(): boolean;
    clear(): void;
    clone(): Observable<T>;
    hasSpecificMask(mask?: number): boolean;
}
