import { RGBAColor } from "core/math";
import { IsIOSMTags, IOSMTags } from "./osm.interfaces";
import { OSMTagSet } from "./osm.tagset";
import { ColorResolver } from "./osm.colorResolver";

export class RoadColors {
    static DefaultColor = RGBAColor.lightgray;

    static ColorMap = new Map<string, string>([
        ["motorway", "#e990a0"],
        ["trunk", "#fbb29a"],
        ["primary", "#fdd7a1"],
        ["secondary", "#f6fabb"],
        ["tertiary", "#ffffff"],
        ["residential", "#ffffff"],
        ["service", "@residential"],
        ["living-street", "#ededed"],
        ["pedestrian", "#dddde8"],
        ["raceway", "pink"],
        ["road", "#ddd"],
        ["footway", "salmon"],
        ["steps", "@footway"],
        ["cycleway", "blue"],
        ["bridleway", "green"],
        ["track", "#996600"],
        ["aeroway", "#bbc"],
        ["runway", "@aeroway"],
        ["taxiway", "@aeroway"],
        ["helipad", "@aeroway"],
    ]);

    public static Resolver = new ColorResolver(RoadColors.DefaultColor, RoadColors.ColorMap);
}

// Define a map for default road widths (in meters)
export const RoadWidthMap = new Map<string, number>([
    ["motorway", 12],
    ["trunk", 10],
    ["primary", 8],
    ["secondary", 6],
    ["tertiary", 5],
    ["residential", 4],
    ["service", 2.5],
    ["track", 2.5],
    ["cycleway", 2.5],
    ["footway", 1.5],
    ["steps", 1.5],
    ["runway", 45],
    ["taxiway", 23],
    ["helipad", 15],
]);

export class RoadOptions {
    static DEFAULT_ROAD_WIDTH = 2;

    public static highwayKey = "highway";
    public static aerowayKey = "aeroway";

    public static IsRoad(record: Record<string, string> | IOSMTags): boolean {
        const tags = IsIOSMTags(record) ? record : new OSMTagSet(record);
        return tags.has(RoadOptions.highwayKey) || tags.has(RoadOptions.aerowayKey);
    }

    public static FromTags(record: Record<string, string> | IOSMTags): RoadOptions | undefined {
        const tags = IsIOSMTags(record) ? record : new OSMTagSet(record);
        if (!this.IsRoad(tags)) {
            return undefined;
        }
        const o = new RoadOptions();

        const type = tags.readValue(RoadOptions.highwayKey) ?? tags.readValue(RoadOptions.aerowayKey) ?? "road";

        o.type = type;
        o.color = RoadColors.Resolver.getColor(type);

        // Look for an explicit width tag, else look up in the map, else fallback to 2.
        const w = tags.readFloat("width", 0);
        o.width = w ? w : RoadWidthMap.get(type) ?? RoadOptions.DEFAULT_ROAD_WIDTH;

        return o;
    }

    public type: string = "road";
    public color: RGBAColor = RoadColors.DefaultColor;
    public width: number = 2;
}
