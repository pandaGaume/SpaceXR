/**
 * Editor schema: declarative metadata describing which properties of a
 * model object are editable or merely viewable, paired with a "kind"
 * string that an editor host resolves to a concrete UI factory.
 *
 * Two decorators live here:
 *
 *   @editor("transform-3d")  - class decorator. Declares that the class
 *     has a custom whole-object editor identified by the given kind.
 *     Editor hosts (e.g. the property panel) can offer a dedicated tab
 *     when a registry has a factory for that kind.
 *
 *   @editable("vector3")     - property decorator. Marks the property
 *     as user-editable; the kind selects which sub-editor renders it.
 *
 *   @viewable("matrix4")     - property decorator. Marks the property
 *     as read-only (computed, derived, immutable from the UI's view);
 *     the kind selects which sub-editor visualises it.
 *
 * The declaration is intentionally side-effect free: no UI is wired
 * here, no registry is touched. The view side (nodeeditor) reads the
 * schema via getEditorSchema() and resolves kinds through its own
 * registry.
 *
 * Storage follows the same metadata pattern as @cloneable: the class
 * decorator writes to the constructor, property decorators accumulate
 * on the prototype. Reflect.getMetadata walks the prototype/constructor
 * chains, so subclasses see inherited fields and an inherited class
 * editor unless they override.
 */

// Symbol.for() registers the symbol in the global Symbol registry, so
// that a module loaded twice (e.g. nodeeditor inlining core AND the
// host page also loading the core UMD bundle directly) still resolves
// to the same key. With plain Symbol(), each module gets its own
// distinct instance and metadata written by one is invisible to the
// reader in the other.
import type { IUnitTag } from "../math/math.units";

export const EditorMetadataKey = Symbol.for("spikypanda.editor");
export const EditableFieldsMetadataKey = Symbol.for("spikypanda.editableFields");

export interface IEditableField {
    readonly propertyName: string;
    readonly kind: string;
    readonly editable: boolean;
    /**
     * Per-field tuning, passed through to the editor factory at
     * instantiation and read by the description layer. See
     * {@link IFieldOptions}.
     */
    readonly options?: IFieldOptions;
}

export interface IEditorSchema {
    /**
     * Kinds of whole-object editors declared on the class. A class may
     * stack several @editor decorators to expose multiple views of the
     * same model (e.g. ["transform-3d", "transform-table"]); subclasses
     * accumulate their own kinds on top of the parent's list, with
     * automatic deduplication. The editor host typically renders one
     * tab per entry. Empty array when no @editor was applied.
     */
    readonly classEditors: ReadonlyArray<string>;

    /**
     * Per-property editor entries declared by @editable / @viewable.
     * Order follows declaration order along the prototype chain,
     * parent fields first.
     */
    readonly fields: ReadonlyArray<IEditableField>;
}

/**
 * Class decorator. Tags the class with a whole-object editor kind that
 * an editor host can render as a dedicated tab when its registry has a
 * matching factory. Stackable: a class may declare several @editor to
 * expose multiple views of the same data; subclasses inherit the
 * parent's editors and append their own. Duplicate kinds are silently
 * deduplicated.
 */
export function editor(kind: string): ClassDecorator {
    return (target) => {
        const existing = (Reflect.getMetadata(EditorMetadataKey, target) as ReadonlyArray<string> | undefined) ?? [];
        if (existing.includes(kind)) {
            return;
        }
        Reflect.defineMetadata(EditorMetadataKey, [...existing, kind], target);
    };
}

/**
 * Everything a property declares about itself beyond its name and its
 * editor kind.
 *
 * Two audiences, one declaration. The editor factories read `min`, `max`,
 * `step`, `layout` and `disabledWhen` to render a row; the description layer
 * reads `unit`, `enum`, `title` and `description` to emit a Thing Description
 * or an OPC UA node. Nothing here is written twice, which is the point: a
 * property that has said what it measures has said it to every consumer.
 *
 * Typed rather than `unknown` for one concrete reason. `unit` used to be a
 * free display string, and free strings drift: the same quantity appeared as
 * "kg.m^2" in one node and "kg·m²" in another, seven enumerations were living
 * in `unit` for want of a field to hold them, and one property declared its
 * unit as "armatureVoltage", which is a property name. None of that is
 * detectable at a free string. All of it is a compile error now.
 */
export interface IFieldOptions {
    /**
     * What the value measures, as a reference into the unit system rather
     * than a symbol. `{ quantity: "Frequency", unit: "Hz" }` resolves through
     * `resolveUnit` to the canonical UCUM code, from which every exposition
     * is derived. The panel renders `unitSymbol()` of it.
     */
    readonly unit?: IUnitTag;
    /**
     * Admissible values, when the property is an enumeration.
     *
     * This is the field whose absence pushed enumerations into `unit`:
     * `unit: "priority | blend | vote"` was a legend, not a unit, and the
     * string editor was parsing the pipe to recover a dropdown from it.
     */
    readonly enum?: ReadonlyArray<string | number>;
    /**
     * Human labels for `enum`, positionally matched.
     *
     * Needed by the numerically coded enumerations, where the value carries
     * no meaning on its own: `enum: [0, 1, 2]` with
     * `enumTitles: ["hann", "hamming", "blackman"]`. Ignored unless `enum` is
     * present and the two have the same length.
     */
    readonly enumTitles?: ReadonlyArray<string>;
    /** Label override, when the property name is not what a user should read. */
    readonly title?: string;
    /** One line of prose for the panel and the description layer. */
    readonly description?: string;
    /** Lower bound. Named for the editor factories, which have always read it. */
    readonly min?: number;
    /** Upper bound. */
    readonly max?: number;
    /** Increment for the number and slider editors. */
    readonly step?: number;
    /** Placeholder text for the string editor's empty input. */
    readonly placeholder?: string;
    /** Row layout hint, e.g. "block" for a vector that needs its own line. */
    readonly layout?: string;
    /**
     * Sub-field arrangement for the vector editors, e.g. "horizontal".
     * Spelling preserved: it is the key the vector editor reads today.
     */
    readonly alignement?: string;

    /**
     * Name of a boolean property that, when truthy, makes this row read-only
     * for the current render pass.
     *
     * The panel reads `model[disabledWhen]` at every pass. Its use is the
     * "driven by a wire" case: an upstream link takes over a property, an
     * `is_X_wired` viewable flips true, and the editable default goes inert
     * without being lost. Example:
     *
     *   @viewable("boolean") get is_gravity_wired() { return ...; }
     *   @editable("vector3", { unit: { quantity: "Acceleration", unit: "mps2" },
     *                          disabledWhen: "is_gravity_wired" })
     *   get gravity() { return wiredOrDefault; }
     *
     * The behavior lives entirely in the panel; core only stores the name.
     */
    readonly disabledWhen?: string;
}

/**
 * @deprecated Use {@link IFieldOptions}, which subsumes it.
 */
export type IEditableOptionsCommon = IFieldOptions;

/**
 * Property decorator. Marks the property as user-editable through the
 * editor of the given kind. The options payload is preserved verbatim
 * and passed back to the factory at instantiation. See
 * {@link IFieldOptions}.
 */
export function editable(kind: string, options?: IFieldOptions) {
    return (target: object, propertyKey: string | symbol): void => {
        appendField(target, {
            propertyName: String(propertyKey),
            kind,
            editable: true,
            options,
        });
    };
}

/**
 * Property decorator. Marks the property as read-only viewable through
 * the editor of the given kind. Same payload semantics as @editable.
 */
export function viewable(kind: string, options?: IFieldOptions) {
    return (target: object, propertyKey: string | symbol): void => {
        appendField(target, {
            propertyName: String(propertyKey),
            kind,
            editable: false,
            options,
        });
    };
}

/**
 * Reader. Returns the aggregated editor schema for a model object.
 * Accepts an instance; resolves classEditor through the constructor's
 * metadata chain and fields through the prototype's metadata chain.
 * Returns an empty fields array and undefined classEditor when nothing
 * has been declared.
 */
export function getEditorSchema(target: object): IEditorSchema {
    const ctor = (target as { constructor?: new (...args: unknown[]) => unknown }).constructor;
    const classEditors = ctor ? ((Reflect.getMetadata(EditorMetadataKey, ctor) as ReadonlyArray<string> | undefined) ?? []) : [];
    const fields = (Reflect.getMetadata(EditableFieldsMetadataKey, target) as ReadonlyArray<IEditableField> | undefined) ?? [];
    return { classEditors, fields };
}

function appendField(target: object, entry: IEditableField): void {
    const proto = (target.constructor as { prototype: object }).prototype;
    // Reflect.getMetadata walks the prototype chain, so this picks up
    // parent-class fields. Storing the merged list on the subclass'
    // own prototype ensures inheritance is preserved without depending
    // on walking at read time.
    const existing = (Reflect.getMetadata(EditableFieldsMetadataKey, proto) as ReadonlyArray<IEditableField> | undefined) ?? [];
    Reflect.defineMetadata(EditableFieldsMetadataKey, [...existing, entry], proto);
}
