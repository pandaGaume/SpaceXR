export type EventListener = (...arg: unknown[]) => void;
export type Listeners = Array<EventListener>;
export interface IEventEmitter {
    on(eventName: string, listener: EventListener): IEventEmitter;
    once(eventName: string, listener: EventListener): IEventEmitter;
    emit(eventName: string, ...args: unknown[]): boolean;
    removeListener(eventName: string, listener?: EventListener): IEventEmitter;
}
