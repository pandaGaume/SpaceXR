export class Stack<T> {
    private _items: T[] = [];

    public constructor(...data: Array<T>) {
        this._items = data ?? [];
    }

    /** Push an element onto the stack */
    push(item: T): void {
        this._items.push(item);
    }

    /** Pop an element from the stack (removes and returns it) */
    pop(): T | undefined {
        return this._items.pop();
    }

    /** Peek at the top element without removing it */
    peek(): T | undefined {
        return this._items[this._items.length - 1];
    }

    /** Check if the stack is empty */
    isEmpty(): boolean {
        return this._items.length === 0;
    }

    /** Get the number of elements in the stack */
    size(): number {
        return this._items.length;
    }

    /** Clear the stack */
    clear(): void {
        this._items = [];
    }
}
