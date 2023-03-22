export interface IEventEmitter {
    on(eventName: string, listener: EventListener): NodeEventEmitter;
    once(eventName: string, listener: EventListener): NodeEventEmitter;
    emit(eventName: string, ...args: unknown[]): boolean;
    removeListener(eventName: string, listener?: EventListener): NodeEventEmitter;
}

export type EventListener = (...arg: unknown[]) => void;

export type Listeners = Array<EventListener>;

export class NodeEventEmitter implements IEventEmitter {
    public static defaultMaxListeners = 100;

    private _events = new Map<string, EventListener[]>();
    private _maxListeners: number = NodeEventEmitter.defaultMaxListeners;

    public addListener(eventName: string, listener: EventListener): NodeEventEmitter {
        return this.on(eventName, listener);
    }

    public on(eventName: string, listener: EventListener): NodeEventEmitter {
        this._registerEvent(eventName, listener, false);
        return this;
    }

    public once(eventName: string, listener: EventListener): NodeEventEmitter {
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
        return this._maxListeners === null ? NodeEventEmitter.defaultMaxListeners : this._maxListeners;
    }

    public setMaxListeners(limit: number): NodeEventEmitter {
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

    public removeAllListeners(eventNames?: Array<string>): NodeEventEmitter {
        if (!eventNames) {
            eventNames = Array.from(this._events.keys());
        }
        eventNames.forEach((eventName) => this._events.delete(eventName));
        return this;
    }

    public removeListener(eventName: string, listener?: EventListener): NodeEventEmitter {
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
