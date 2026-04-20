import { ISO6391 } from "./iso6391";

/**
 * A value that can either be fixed (plain `string`) or localized
 * (a {@link LocalString} with one entry per ISO 639-1 code).
 *
 * Consumers typically accept a `LocalizableString` and call
 * {@link GetLocalizableStringValue} to resolve it for the current locale.
 */
export type LocalizableString = LocalString | string;

/** Narrow a {@link LocalizableString} to a proper {@link LocalString}. */
export function IsLocalizable(item: LocalizableString): item is LocalString {
    return typeof item !== "string";
}

/**
 * Shape accepted by {@link DeserializeLocalizableString} when loading
 * JSON. Either the raw `{ en: "...", fr: "..." }` map, or the full
 * `{ contents: { ... } }` envelope matching what `LocalString` would
 * serialize to.
 */
export type LocalStringInput = string | LocalString | Record<string, string> | { contents: Record<string, string> } | null | undefined;

/**
 * Build a {@link LocalizableString} from an arbitrary JSON-ish input.
 *
 * Accepted shapes:
 *  - `undefined` / `null`                                  -> `undefined`
 *  - a plain `string`                                      -> returned as-is (fixed, non-localized)
 *  - a {@link LocalString} instance                        -> returned as-is
 *  - an object with a `contents` field of code-to-string   -> rebuilt into a LocalString
 *  - a plain object mapping codes to strings               -> rebuilt into a LocalString
 *
 * Unknown language codes are silently skipped.
 */
export function DeserializeLocalizableString(input: LocalStringInput): LocalizableString | undefined {
    if (input == null) return undefined;
    if (typeof input === "string") return input;
    if (input instanceof LocalString) return input;

    // Either the `{ contents: { ... } }` envelope or the raw `{ code: value }` map.
    const source: Record<string, unknown> =
        typeof (input as { contents?: unknown }).contents === "object" && (input as { contents?: unknown }).contents !== null
            ? (input as { contents: Record<string, unknown> }).contents
            : (input as Record<string, unknown>);

    const ls = new LocalString();
    ls.deserialize(source);
    return ls;
}

/**
 * Resolve a {@link LocalizableString} to a plain `string`.
 *
 * @param str  The localizable value to resolve.
 * @param code Preferred ISO 639-1 code. Falls back to
 *             {@link LocalString.DefaultCode} when missing or unknown.
 * @returns The resolved string, or `undefined` if the value is a
 *          LocalString with no entry for the requested code AND no entry
 *          for the default code.
 */
export function GetLocalizableStringValue(str: LocalizableString, code?: string): string | undefined {
    return typeof str === "string" ? str : str.getValue(code);
}

/**
 * Holds one string per ISO 639-1 language code. Unknown codes passed to
 * {@link tryAdd} or {@link deserialize} are rejected (no exception,
 * they are just ignored).
 */
export class LocalString {
    /**
     * Default language code used as fallback when a locale-specific
     * value is missing. Set this once at application startup.
     */
    public static DefaultCode: string = "en";

    public readonly contents: Map<string, string>;

    public constructor() {
        this.contents = new Map<string, string>();
    }

    /**
     * Add or replace the value for a given language code.
     * @returns `true` if the code is a valid ISO 639-1 code and the
     *          value was stored; `false` otherwise.
     */
    public tryAdd(code: string, value: string): boolean {
        if (!ISO6391.validate(code)) return false;
        this.contents.set(code, value);
        return true;
    }

    /**
     * Replace all entries from a plain object mapping codes to strings.
     * Non-string values are coerced to strings; unknown codes are
     * skipped.
     */
    public deserialize(input: Record<string, unknown>): void {
        this.contents.clear();
        if (!input || typeof input !== "object") return;
        for (const code of Object.keys(input)) {
            if (ISO6391.validate(code)) {
                this.contents.set(code, String(input[code]));
            }
        }
    }

    /**
     * Look up the value for a specific code, falling back to
     * {@link DefaultCode} when missing.
     *
     * @returns `undefined` only when neither `code` nor the default code
     *          have a value.
     */
    public getValue(code?: string): string | undefined {
        if (code) {
            const v = this.contents.get(code);
            if (v !== undefined || code === LocalString.DefaultCode) {
                return v;
            }
        }
        return this.contents.get(LocalString.DefaultCode);
    }
}
