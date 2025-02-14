import { Observable } from "../events";
import { IDisposable, IValidable, Nullable } from "../types";

export interface ILinkedListItem<T> {
    value: T;
    next: Nullable<ILinkedListItem<T>>;
    prev: Nullable<ILinkedListItem<T>>;
}

export interface ILinkedList<T> extends Iterable<T> {
    head: Nullable<ILinkedListItem<T>>;
    tail: Nullable<ILinkedListItem<T>>;
    length: number;
    add(value: T): ILinkedListItem<T>;
    addFirst(value: T): ILinkedListItem<T>;
    addLast(value: T): ILinkedListItem<T>;
    addAfter(value: T, node: ILinkedListItem<T>): ILinkedListItem<T>;
    addBefore(value: T, node: ILinkedListItem<T>): ILinkedListItem<T>;
    remove(item: ILinkedListItem<T>): void;
    removeFirst(): void;
    removeLast(): void;
    clear(): void;
}

export interface IWeighted {
    weightChangedObservable?: Observable<IWeighted>;
    weight?: number;
}

export interface ICollection<T> extends Iterable<T>, IValidable, IDisposable {
    addedObservable: Observable<Array<T>>;
    removedObservable: Observable<Array<T>>;
    count: number;

    get(predicate?: (i: T) => boolean): IterableIterator<T>;
    add(...item: Array<T>): void;
    remove(...item: Array<T>): void;
    clear(): void;
}

export interface IOrderedCollection<T extends IWeighted> extends ICollection<T> {}

export interface IStack<T> {
    push(item: T): void;
    /** Pop an element from the stack (removes and returns it) */
    pop(): T | undefined;
    /** Peek at the top element without removing it */
    peek(): T | undefined;
    /** Check if the stack is empty */
    isEmpty(): boolean;
    /** Get the number of elements in the stack */
    size(): number;
    /** Clear the stack */
    clear(): void;
}
