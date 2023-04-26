import { IEventEmitter, EventListener, Listeners } from "./events.interfaces";

export class EventEmitter implements IEventEmitter {
    public static defaultMaxListeners = 100;

    private _events = new Map<string, Listeners>();
    private _maxListeners: number;

    public constructor(maxListeners: number = EventEmitter.defaultMaxListeners) {
        this._maxListeners = maxListeners;
    }

    public addListener(eventName: string, listener: EventListener): EventEmitter {
        return this.on(eventName, listener);
    }

    public on(eventName: string, listener: EventListener): EventEmitter {
        this._registerEvent(eventName, listener, false);
        return this;
    }

    public once(eventName: string, listener: EventListener): EventEmitter {
        this._registerEvent(eventName, listener, true);
        return this;
    }

    public emit(eventName: string, ...args: unknown[]): boolean {
        const listeners = this._events.get(eventName);
        const listenerCount = this.listenerCount(eventName);
        if (listeners) {
            listeners.map((listener) => listener(...args));
        }
        return listenerCount === 0 ? false : true;
    }

    public eventNames(): string[] {
        return Array.from(this._events.keys());
    }

    public getMaxListeners(): number {
        return this._maxListeners === null ? EventEmitter.defaultMaxListeners : this._maxListeners;
    }

    public setMaxListeners(limit: number): EventEmitter {
        this._maxListeners = limit;
        return this;
    }

    public listeners(eventName: string) {
        return this._events.get(eventName);
    }

    public listenerCount(eventName: string): number {
        const event = this._events.get(eventName);
        return event === undefined ? 0 : event.length;
    }

    public removeAllListeners(eventNames?: Array<string>): EventEmitter {
        if (!eventNames) {
            eventNames = Array.from(this._events.keys());
        }
        eventNames.forEach((eventName) => this._events.delete(eventName));
        return this;
    }

    public removeListener(eventName: string, listener?: EventListener): EventEmitter {
        if (this.listeners) {
            const l = this.listeners(eventName);
            if (l) {
                const listeners = l.filter((item) => listener === undefined || listener === null || item === listener);
                this._events.set(eventName, listeners);
            }
        }
        return this;
    }

    private _registerEvent(eventName: string, listener: EventListener, type: boolean): void {
        if (this._ListenerLimitReached(eventName)) {
            console.log("Maximum listener reached, new Listener not added");
            return;
        }
        if (type === true) {
            listener = this._createOnceListener(listener, eventName);
        }
        const listeners = this._createListeners(listener, this.listeners(eventName));
        this._events.set(eventName, listeners);
        return;
    }

    private _createListeners(listener: EventListener, listeners?: Listeners): Listeners {
        if (!listeners) {
            listeners = new Array<EventListener>();
        }
        listeners.push(listener);
        return listeners;
    }

    private _createOnceListener(listener: EventListener, eventName: string): EventListener {
        const newListener = (...args: []) => {
            this.removeListener(eventName, listener);
            return listener(...args);
        };
        return newListener;
    }

    private _ListenerLimitReached(eventName: string): boolean {
        return this.listenerCount(eventName) === this.getMaxListeners() ? true : false;
    }
}
