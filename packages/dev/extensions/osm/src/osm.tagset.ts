import { IOSMTags } from "./osm.interfaces";

export class OSMTagSet implements IOSMTags {
    private raw: Record<string, string>;

    constructor(initial: Record<string, string> = {}) {
        this.raw = initial;
    }

    public readValue(key: string): string | undefined {
        const value = this.raw[key];
        return value?.trim();
    }

    public readString(key: string, defaultValue: string): string {
        const value = this.raw[key];
        return value?.trim() ?? defaultValue;
    }

    public readInt(key: string, defaultValue: number): number {
        const val = this.readValue(key);
        if (val !== undefined) {
            const parsed = parseInt(val, 10);
            return isNaN(parsed) ? defaultValue : parsed;
        }
        return defaultValue;
    }

    public readFloat(key: string, defaultValue: number): number {
        const val = this.readValue(key);
        if (val !== undefined) {
            const parsed = parseFloat(val);
            return isNaN(parsed) ? defaultValue : parsed;
        }
        return defaultValue;
    }

    public readBool(key: string, defaultValue: boolean): boolean {
        const val = this.readValue(key)?.toLowerCase();
        if (val === undefined) return defaultValue;
        if (["1", "yes", "true"].includes(val)) return true;
        if (["0", "no", "false"].includes(val)) return false;
        return defaultValue;
    }

    public has(key: string): boolean {
        return Object.prototype.hasOwnProperty.call(this.raw, key);
    }

    public toJSON(): Record<string, string> {
        return { ...this.raw };
    }
}
