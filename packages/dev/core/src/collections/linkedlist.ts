// custom LinkedList implementation

import { Nullable } from "../types";
import { ILinkedList, ILinkedListItem } from "./collections.interfaces";

export class LinkedListNode<T> implements ILinkedListItem<T> {
    public value: T;
    public next: Nullable<ILinkedListItem<T>>;
    public prev: Nullable<ILinkedListItem<T>>;
    constructor(value: T) {
        this.value = value;
        this.next = null;
        this.prev = null;
    }
}

export class LinkedList<T> implements ILinkedList<T> {
    private _head: Nullable<ILinkedListItem<T>>;
    private _tail: Nullable<ILinkedListItem<T>>;
    private _length: number;

    public constructor(...values: Array<T>) {
        this._head = null;
        this._tail = null;
        this._length = 0;
        for (var value of values) {
            this.add(value);
        }
    }

    public get head(): Nullable<ILinkedListItem<T>> {
        return this._head;
    }

    public get tail(): Nullable<ILinkedListItem<T>> {
        return this._tail;
    }

    public get length(): number {
        return this._length;
    }

    public [Symbol.iterator](): IterableIterator<T> {
        let node = this._head;

        const iterator: IterableIterator<T> = {
            next(): IteratorResult<T> {
                if (node) {
                    const status = {
                        done: false,
                        value: node.value,
                    };
                    node = node.next;
                    return status;
                }

                return {
                    done: true,
                    value: null as any,
                };
            },
            [Symbol.iterator]() {
                return this;
            },
        };
        return iterator;
    }

    public add(value: T): ILinkedListItem<T> {
        return this.addLast(value);
    }

    public addLast(value: T): ILinkedListItem<T> {
        if (this._tail === null) {
            this._head = this._tail = this._buildNode(value);
            this._length++;
        }
        return this.addAfter(value, this._tail);
    }

    public addAfter(value: T, node?: ILinkedListItem<T>): ILinkedListItem<T> {
        if (this._tail === null || !node) {
            return this.add(value);
        }
        var newNode = this._buildNode(value);
        this._addAfter(node, newNode);
        return newNode;
    }

    public addFirst(value: T): ILinkedListItem<T> {
        if (this._head === null) {
            this._head = this._tail = this._buildNode(value);
            this._length++;
        }
        return this.addBefore(value, this._head);
    }

    public addBefore(value: T, node: ILinkedListItem<T>): ILinkedListItem<T> {
        if (this._tail === null || !node) {
            return this.add(value);
        }
        var newNode = this._buildNode(value);
        this._addBefore(node, newNode);
        return newNode;
    }

    private _addAfter(newNode: ILinkedListItem<T>, node: ILinkedListItem<T>) {
        newNode.next = node.next;
        newNode.prev = node;
        node.next = newNode;
        if (newNode.next) {
            newNode.next.prev = newNode;
        }
        this._length++;
        if (node === this._tail) {
            this._tail = newNode;
        }
    }

    private _addBefore(newNode: ILinkedListItem<T>, node: ILinkedListItem<T>) {
        newNode.prev = node.prev;
        newNode.next = node;
        node.prev = newNode;
        if (newNode.prev) {
            newNode.prev.next = newNode;
        }
        this._length++;
        if (node === this._head) {
            this._head = newNode;
        }
    }

    public remove(item: ILinkedListItem<T>): void {
        if (item) {
            if (this._head === item) {
                this.removeFirst();
            } else if (this._tail === item) {
                this.removeLast();
            } else {
                if (item.prev) {
                    item.prev.next = item.next;
                }
                if (item.next) {
                    item.next.prev = item.prev;
                }
            }
        }
    }

    public removeFirst(): void {
        if (this._head) {
            var toRemove = this._head;
            if (!toRemove.next) {
                /* only one item */
                this._head = this._tail = null;
            } else {
                this._head = toRemove.next;
                this._head.prev = null;
            }
            this._length--;
        }
    }

    public removeLast(): void {
        if (this._tail) {
            var toRemove = this._tail;
            if (!toRemove.prev) {
                /* only one item */
                this._head = this._tail = null;
            } else {
                this._tail = toRemove.prev;
                this._tail.next = null;
            }
            this._length--;
        }
    }

    public clear(): void {
        this._head = this._tail = null;
        this._length = 0;
    }

    protected _buildNode(value: T): ILinkedListItem<T> {
        return new LinkedListNode<T>(value);
    }
}
