import { Nullable } from "../types";
import { ILinkedList, ILinkedListItem } from "./collections.interfaces";
export declare class LinkedListNode<T> implements ILinkedListItem<T> {
    value: T;
    next: Nullable<ILinkedListItem<T>>;
    prev: Nullable<ILinkedListItem<T>>;
    constructor(value: T);
}
export declare class LinkedList<T> implements ILinkedList<T> {
    private _head;
    private _tail;
    private _length;
    constructor(...values: Array<T>);
    get head(): Nullable<ILinkedListItem<T>>;
    get tail(): Nullable<ILinkedListItem<T>>;
    get length(): number;
    [Symbol.iterator](): IterableIterator<T>;
    add(value: T): ILinkedListItem<T>;
    addLast(value: T): ILinkedListItem<T>;
    addAfter(value: T, node?: ILinkedListItem<T>): ILinkedListItem<T>;
    addFirst(value: T): ILinkedListItem<T>;
    addBefore(value: T, node: ILinkedListItem<T>): ILinkedListItem<T>;
    private _addAfter;
    private _addBefore;
    remove(item: ILinkedListItem<T>): void;
    removeFirst(): void;
    removeLast(): void;
    clear(): void;
    protected _buildNode(value: T): ILinkedListItem<T>;
}
