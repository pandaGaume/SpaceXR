import { RGBAColor } from "core/math";
import { IsIOSMTags, IOSMTags } from "./osm.interfaces";
import { OSMTagSet } from "./osm.tagset";
import { ColorResolver } from "./osm.colorResolver";

export class ForestColors {
    static DefaultColor = RGBAColor.darkgreen;

    static ColorMap = new Map<string, string>([
        ["deciduous", "forestgreen"],
        ["evergreen", "darkgreen"],
        ["broadleaved", "@deciduous"],
        ["needleleaved", "@evergreen"],
        ["mixed", "#228B22"],
    ]);

    static Resolver = new ColorResolver(ForestColors.DefaultColor, ForestColors.ColorMap);
}

export class ForestOptions {
    public static woodKeywords = "wood";
    public static treeKeywords = "trees";

    public static IsForest(record: Record<string, string> | IOSMTags): boolean {
        const tags: IOSMTags = IsIOSMTags(record) ? record : new OSMTagSet(record);
        return tags.readValue("natural") === ForestOptions.woodKeywords || tags.readValue("landcover") === ForestOptions.treeKeywords;
    }

    public static FromTags(record: Record<string, string> | IOSMTags): ForestOptions | undefined {
        const tags: IOSMTags = IsIOSMTags(record) ? record : new OSMTagSet(record);

        if (!this.IsForest(tags)) {
            return undefined;
        }
        const o = new ForestOptions();

        o.type = tags.readValue("leaf_cycle") ?? tags.readValue("leaf_type") ?? "mixed";
        o.color = ForestColors.Resolver.getColor(o.type);

        return o;
    }

    public type: string = "mixed";
    public color: RGBAColor = ForestColors.DefaultColor;
}
