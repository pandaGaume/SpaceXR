import { PropertyChangedEventArgs } from "../events/events.args";
import { Observable } from "../events/events.observable";
import { cloneable, CloneMetadataKey, IGraphItem, IsCloneable, ITaggable } from "./graph.interfaces";

export class GraphItem<B = unknown> implements IGraphItem<B> {
    private _id?: any;
    private _tag?: string;
    private _typeValue?: string;
    private _bag?: B;
    private _onPropertyChanged?: Observable<PropertyChangedEventArgs<unknown, unknown>>;

    public get onPropertyChanged(): Observable<PropertyChangedEventArgs<unknown, unknown>> {
        if (!this._onPropertyChanged) {
            this._onPropertyChanged = new Observable<PropertyChangedEventArgs<unknown, unknown>>();
        }
        return this._onPropertyChanged;
    }

    public get tag(): string | undefined {
        return this._tag;
    }

    public get id(): any | undefined {
        return this._id;
    }

    public set id(v: any) {
        const old = this._id;
        this._id = v;
        this.notifyPropertyChanged("id", old, v);
    }

    public get bag(): B | undefined {
        return this._bag;
    }

    public set bag(v: B | undefined) {
        const old = this._bag;
        this._bag = v;
        this.notifyPropertyChanged("bag", old, v);
    }

    /** Ontology type tag (see ITyped). Controlled category drawn from the core
     *  `ONTOLOGY` registry; `@cloneable` so it round-trips through
     *  serialize()/clone() uniformly for every node AND link. `undefined` =
     *  untyped (serializeField drops it, so untyped items carry nothing). */
    @cloneable
    public get type(): string | undefined {
        return this._typeValue;
    }
    public set type(v: string | undefined) {
        this.setField("type", this._typeValue, v, (n) => {
            this._typeValue = n;
        });
    }

    public withTag(tag: string): ITaggable {
        const old = this._tag;
        this._tag = tag;
        this.notifyPropertyChanged("tag", old, tag);
        return this;
    }

    public dispose(): void {
        this._onPropertyChanged?.clear();
        this._onPropertyChanged = undefined;
    }

    public clone(): this {
        const ctor = this.constructor as new () => this;
        const clone = new ctor();
        const props = Reflect.getMetadata(CloneMetadataKey, this) || [];

        for (const key of props) {
            const value = (this as any)[key];
            (clone as any)[key] = IsCloneable(value) ? value.clone() : structuredClone(value);
        }

        return clone;
    }

    /**
     * JSON-friendly snapshot of every `@cloneable` field. Used by the
     * editor's save/load to round-trip user-edited values (editables)
     * and persistent runtime state (counters, accumulators, last poses).
     *
     * The rule: any port input that has NO incoming wire falls back to
     * the matching editable, so the editable IS the live value and must
     * persist. We treat every `@cloneable` field as belonging to that
     * persistable set — same metadata Reflect-key as clone() so the
     * two operations stay in sync (cloneable ⇔ savable, by construction).
     *
     * Field handling:
     *   - Primitives (number / boolean / string / null) pass through
     *   - Class instances with own enumerable props (Cartesian3, etc.)
     *     are spread to a plain `{...obj}` snapshot — the type is
     *     reconstructed in deserialize() by Object.assign'ing back into
     *     the live instance, preserving the prototype + methods
     *   - Typed arrays are intentionally NOT supported in V1: they're
     *     almost always runtime state that should be excluded from
     *     @cloneable anyway. Future support would JSON-encode them
     *     under a sentinel wrapper.
     *
     * Returns a plain object suitable for `JSON.stringify`.
     */
    public serialize(): Record<string, unknown> {
        const props: ReadonlyArray<string> = Reflect.getMetadata(CloneMetadataKey, this) || [];
        const out: Record<string, unknown> = {};
        for (const key of props) {
            const value = (this as Record<string, unknown>)[key];
            out[key] = serializeField(value);
        }
        return out;
    }

    /**
     * Restore the fields captured by `serialize()`. Counterpart that
     * mutates `this` in place. Missing keys leave the existing value
     * untouched, so a forward-compatible save (a future version added
     * a new editable) still loads cleanly on an older runtime — the
     * new field stays at its constructor-time default.
     *
     * For class-instance fields we use Object.assign onto the live
     * instance instead of replacing the reference. Two reasons:
     *   1. Preserves the prototype + methods (Cartesian3.distance(),
     *      etc.) — the vector3 editor relies on `cur.constructor` for
     *      its rebuild path, which only works on a real Cartesian3.
     *   2. Avoids firing setField (which expects to be called by the
     *      user via the @editable setter, not by load). The runtime
     *      sees the new value on the very next tick.
     */
    public deserialize(blob: unknown): void {
        if (!blob || typeof blob !== "object") return;
        const data = blob as Record<string, unknown>;
        const props: ReadonlyArray<string> = Reflect.getMetadata(CloneMetadataKey, this) || [];
        for (const key of props) {
            if (!Object.prototype.hasOwnProperty.call(data, key)) continue;
            const stored = data[key];
            const current = (this as Record<string, unknown>)[key];
            if (current && typeof current === "object" && stored && typeof stored === "object" && !Array.isArray(current) && !Array.isArray(stored)) {
                // Class-instance field (Cartesian3, Quaternion, ...).
                // Mutate the existing instance to keep its prototype
                // intact for downstream editors / methods.
                Object.assign(current as object, stored);
            } else {
                (this as Record<string, unknown>)[key] = stored;
            }
            // Fire a notification AFTER the write so any subscribed
            // editor (number / string / slider field rows in the
            // property panel) refreshes itself. Without this, a panel
            // that was mounted BEFORE the deserialize ran (e.g. the
            // node was already selected when the user loaded the file,
            // or an autosave restored on page reload) keeps showing
            // the constructor-default value forever — the panel reads
            // the field once at mount and only reacts to subsequent
            // setField() calls, never to direct field writes.
            //
            // We fire under TWO names: the raw metadata key (e.g.
            // `"_outputType"`) AND, when it starts with an underscore,
            // the stripped public name (`"outputType"`). The convention
            // across the codebase is `@cloneable private _X` paired
            // with a public getter/setter `X`; editors subscribe by
            // the public name, so the stripped notification is what
            // actually reaches them. The raw-name notification is
            // kept for any subscriber that happens to watch the
            // private storage directly (none today, but cheap).
            const publicName = key.startsWith("_") ? key.substring(1) : key;
            this.notifyPropertyChanged(key, current, stored);
            if (publicName !== key) {
                this.notifyPropertyChanged(publicName, current, stored);
            }
        }
    }

    protected notifyPropertyChanged<T>(propertyName: string, oldValue: T, newValue: T): void {
        if (oldValue === newValue) {
            return;
        }
        const obs = this._onPropertyChanged;
        if (!obs || !obs.hasObservers()) {
            return;
        }
        obs.notifyObservers(new PropertyChangedEventArgs<unknown, unknown>(this, oldValue, newValue, propertyName));
    }

    /**
     * Reactive field setter. Short-circuits when newValue strictly equals
     * currentValue (no write, no notification), otherwise invokes the
     * writer callback to commit the value to the private backing field
     * and fires notifyPropertyChanged.
     *
     * The writer callback exists because TypeScript has no portable
     * way to write through a private field name passed as a string.
     *
     * Usage:
     *     public set roll(v: number) {
     *         this.setField("roll", this._roll, v, (x) => { this._roll = x; });
     *     }
     *
     * Returns true if the value changed (write + notify happened),
     * false if the call was a no-op.
     */
    protected setField<T>(propertyName: string, currentValue: T, newValue: T, writer: (value: T) => void): boolean {
        if (currentValue === newValue) {
            return false;
        }
        writer(newValue);
        this.notifyPropertyChanged(propertyName, currentValue, newValue);
        return true;
    }
}

/**
 * Recursive JSON-friendly conversion of a single field value. Centralised
 * so serialize() above stays readable. The shape mirrors what
 * deserialize expects to see come back from JSON.parse().
 *
 * Primitives pass through as-is. Plain objects (including class instances
 * like Cartesian3) become `{...obj}` snapshots — `JSON.stringify` would
 * do the same, but doing it explicitly here means nested @cloneable
 * objects could recurse into their own serialize() if desired (future
 * extension; V1 just spreads).
 */
function serializeField(value: unknown): unknown {
    if (value === null || value === undefined) return value;
    const t = typeof value;
    if (t === "number" || t === "string" || t === "boolean") return value;
    if (Array.isArray(value)) {
        return value.map(serializeField);
    }
    if (t === "object") {
        // Spread strips methods + symbols, keeping just own enumerable
        // data props — exactly what JSON.stringify would emit.
        return { ...(value as Record<string, unknown>) };
    }
    // Functions, symbols: not serializable, drop silently.
    return undefined;
}
