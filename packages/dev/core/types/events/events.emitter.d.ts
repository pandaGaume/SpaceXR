import { IEventEmitter, EventListener, Listeners } from "./events.interfaces";
export declare class EventEmitter implements IEventEmitter {
    static defaultMaxListeners: number;
    private _events;
    private _maxListeners;
    constructor(maxListeners?: number);
    addListener(eventName: string, listener: EventListener): EventEmitter;
    on(eventName: string, listener: EventListener): EventEmitter;
    once(eventName: string, listener: EventListener): EventEmitter;
    emit(eventName: string, ...args: unknown[]): boolean;
    eventNames(): string[];
    getMaxListeners(): number;
    setMaxListeners(limit: number): EventEmitter;
    listeners(eventName: string): Listeners | undefined;
    listenerCount(eventName: string): number;
    removeAllListeners(eventNames?: Array<string>): EventEmitter;
    removeListener(eventName: string, listener?: EventListener): EventEmitter;
    private _registerEvent;
    private _createListeners;
    private _createOnceListener;
    private _ListenerLimitReached;
}
