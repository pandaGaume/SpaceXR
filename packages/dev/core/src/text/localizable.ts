import { ISO6391 } from "./iso6391";

export type LocalizableString = LocalString | String;

export function IsLocalizable(item: LocalizableString): item is LocalString {
    return item instanceof LocalString;
}

export function DeserializeLocalizableString(input: any): LocalizableString | undefined {
    if (!input) {
        return undefined;
    }
    if (input["contents"]) {
        return input;
    }
    var ls = new LocalString();
    ls.deserialize(input);
    return ls;
}

export function GetLocalizableStringValue(str: LocalizableString, code?: string): String | undefined {
    return str instanceof String ? str : str.getValue(code);
}

export class LocalString {
    public static DefaultCode: string = "en";

    contents: Map<string, string>;

    public constructor() {
        this.contents = new Map<string, string>();
    }

    public tryAdd(code: string, value: string): boolean {
        if (ISO6391.validate(code)) {
            this.contents.set(code, value);
            return true;
        }
        return false;
    }

    public deserialize(input: any) {
        this.contents.clear();
        for (var p in input.getOwnPropertyNames()) {
            if (ISO6391.validate(p)) {
                this.contents.set(p, input[p]);
            }
        }
    }

    public getValue(code?: string): string | undefined {
        if (code) {
            var v = this.contents.get(code);
            if (v || code == LocalString.DefaultCode) {
                return v;
            }
        }
        return this.contents.get(LocalString.DefaultCode);
    }
}
