import { RGBAColor } from "core/math";
import { IsIOSMTags, IOSMTags } from "./osm.interfaces";
import { OSMTagSet } from "./osm.tagset";
import { ColorResolver } from "./osm.colorResolver";

export class WaterColors {
    static DefaultColor = RGBAColor.blue;

    static ColorMap = new Map<string, string>([
        ["lake", "blue"],
        ["lagoon", "lightblue"],
        ["pond", "@lake"],
        ["reflecting_pool", "steelblue"],
        ["reservoir", "@lake"],
        ["basin", "@lake"],
        ["river", "@lake"],
        ["fish_pass", "@lake"],
        ["oxbow", "@lake"],
        ["lock", "@lake"],
        ["moat", "@lake"],
        ["wastewater", "lightseagreen"],
        ["stream_pool", "@lake"],
    ]);

    public static Resolver = new ColorResolver(WaterColors.DefaultColor, WaterColors.ColorMap);
}

export class WaterOptions {
    public static waterKeyword = "water";

    public static IsWater(record: Record<string, string> | IOSMTags): boolean {
        const tags: IOSMTags = IsIOSMTags(record) ? record : new OSMTagSet(record);
        return tags.readValue("natural") === WaterOptions.waterKeyword || tags.readValue("landcover") === WaterOptions.waterKeyword;
    }

    public static FromTags(record: Record<string, string> | IOSMTags): WaterOptions | undefined {
        const tags: IOSMTags = IsIOSMTags(record) ? record : new OSMTagSet(record);

        if (!this.IsWater(tags)) {
            return undefined;
        }
        const o = new WaterOptions();
        const waterType = tags.readValue("water") ?? "lake";
        o.type = waterType;
        o.color = WaterColors.Resolver.getColor(waterType);

        return o;
    }

    color: RGBAColor = WaterColors.DefaultColor;
    type: string = "lake";
}
