import { RGBAColor } from "core/math";
import { IsIOSMTags, IOSMTags } from "./osm.interfaces";
import { OSMTagSet } from "./osm.tagset";
import { Nullable } from "core/types";

export enum RoofShape {
    flat,
    skillion,
    gabled,
    halfHipped,
    hipped,
    pyramidal,
    gambrel,
    mansard,
    dome,
    onion,
    round,
    saltbox,
}

export enum RoofOrientation {
    along,
    across,
}

export class BuildingMaterialOptions {
    color: Nullable<RGBAColor> = null;
    material: Nullable<string> = null;
}

export class RoofOptions {
    public static CardinalDirections: Map<string, number> = new Map([
        ["N", 0],
        ["NNE", 22],
        ["NE", 45],
        ["ENE", 67],
        ["E", 90],
        ["ESE", 112],
        ["SE", 135],
        ["SSE", 157],
        ["S", 180],
        ["SSW", 202],
        ["SW", 225],
        ["WSW", 247],
        ["W", 270],
        ["WNW", 292],
        ["NW", 315],
        ["NNW", 337],
    ]);

    public static Shapes: Map<string, RoofShape> = new Map([
        ["flat", RoofShape.flat],
        ["skillion", RoofShape.skillion],
        ["gabled", RoofShape.gabled],
        ["halfHipped", RoofShape.halfHipped],
        ["hipped", RoofShape.hipped],
        ["pyramidal", RoofShape.pyramidal],
        ["gambrel", RoofShape.gambrel],
        ["mansard", RoofShape.mansard],
        ["dome", RoofShape.dome],
        ["onion", RoofShape.onion],
        ["round", RoofShape.round],
        ["saltbox", RoofShape.saltbox],
    ]);

    public static IsRoof(record: Record<string, string> | IOSMTags): boolean {
        const tags: IOSMTags = IsIOSMTags(record) ? record : new OSMTagSet(record);
        return tags.readValue("roof:shape") !== undefined;
    }

    public static FromTags(record: Record<string, string> | IOSMTags): RoofOptions | undefined {
        const tags: IOSMTags = IsIOSMTags(record) ? record : new OSMTagSet(record);
        if (!this.IsRoof(tags)) {
            return undefined;
        }

        const o = new RoofOptions();

        const shapeVal = tags.readValue("roof:shape");
        if (shapeVal && RoofShape.hasOwnProperty(shapeVal)) {
            o.shape = RoofShape[shapeVal as keyof typeof RoofShape];
        }

        const orientation = tags.readValue("roof:orientation");
        if (orientation === "across") {
            o.orientation = RoofOrientation.across;
        }

        o.height = tags.readFloat("roof:height", 0);
        o.angle = tags.readFloat("roof:angle", 0);
        o.levels = tags.readInt("roof:levels", 0);

        const dir = tags.readValue("roof:direction");
        if (dir) {
            o.direction = this.CardinalDirections.get(dir) ?? parseFloat(dir);
        }

        const color = tags.readValue("roof:colour");
        const mat = tags.readValue("roof:material");
        if (color || mat) {
            o.material = {
                color: color ? RGBAColor.Parse(color) : null,
                material: mat ?? null,
            };
        }
        return o;
    }

    // roof shape
    public shape: RoofShape = RoofShape.flat;
    // For roofs with a ridge the ridge is assumed to be parallel to the longest side of the building (roof:orientation=along). But it can be tagged explicitly with this tag.
    public orientation: RoofOrientation = 0;
    // roof height in meters
    public height: number = 0;
    // Alternatively to roof:height=*, roof height can be indicated implicitly by providing the inclination of the sides (in degrees).
    public angle: number = 0;
    // Number of floors within the roof, which are not already counted in building:levels=*.
    public levels: number = 0;
    // direction from back side of roof to front, i.e. the direction towards which the main face of the roof is looking
    // The value should either be a cardinal direction (N, S, NW, ESE) or an angle in degree from north clockwise.
    public direction: number = 0;

    public material: Nullable<BuildingMaterialOptions> = null;
}

export class BuildingOptions {
    public static IsBuilding(record: Record<string, string> | IOSMTags): boolean {
        const tags: IOSMTags = IsIOSMTags(record) ? record : new OSMTagSet(record);
        return tags.readValue("building") !== undefined || tags.readValue("building:part") !== undefined;
    }

    public static FromTags(record: Record<string, string> | IOSMTags): BuildingOptions | undefined {
        var tags = IsIOSMTags(record) ? record : new OSMTagSet(record);

        if (!this.IsBuilding(tags)) {
            return undefined;
        }

        var o: BuildingOptions = new BuildingOptions();
        // height and levels
        let str: string | undefined;
        o.height = tags.readInt("height", 0);
        o.min_height = tags.readInt("min_height", 0);
        o.levels = tags.readInt("building:levels", 0);
        o.min_levels = tags.readInt("building:min_level", 0);

        // roof shape
        o.roof = RoofOptions.FromTags(tags) ?? null;

        // surface and material
        var om = new BuildingMaterialOptions();

        str = tags.readValue("building:colour");
        if (str) {
            om.color = RGBAColor.Parse(str);
        }
        om.material = tags.readValue("building:material") ?? null;

        o.material = om.color || om.material ? om : null;
        return o;
    }

    // Distance between the lowest possible position with ground contact and the top of the roof of the building, excluding antennas, spires and other equipment mounted on the roof.
    public height: number = 0;
    // Approximate height below the building structure.
    // Note that when min_height is used, height is still defined as the distance from the ground to the top of the structure.So "bridge" with 3 meters height,
    // where bottom part of the bridge is positioned 10 meters above ground level will have min_height= 10, height = 13.
    public min_height: number = 0;
    // Number of floors of the building above ground (without levels in the roof), to be able to texture the building in a nice way.
    // If you tag new buildings, try to give a height value.Try to use building: levels =* only in addition to an height tag!            var levels;
    public levels: number = 0;
    // levels skipped in a building part, analogous to min_height
    public min_levels: number = 0;

    public material: Nullable<BuildingMaterialOptions> = null;

    public roof: Nullable<RoofOptions> = null;
}
