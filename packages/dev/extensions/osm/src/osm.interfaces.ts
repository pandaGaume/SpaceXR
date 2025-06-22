import { IGeo2 } from "core/geography/geography.interfaces";
export type OSMRecordType = "node" | "way" | "relation";

export type OSMElementType = "node" | "way" | "relation";

export interface IOSMTags {
    readValue(key: string): string | undefined;
    readString(key: string, defaultValue: string): string;
    readInt(key: string, defaultValue: number): number;
    readFloat(key: string, defaultValue: number): number;
    readBool(key: string, defaultValue: boolean): boolean;
    has(key: string): boolean;
    toJSON(): Record<string, string>;
}

export function IsIOSMTags(obj: unknown): obj is IOSMTags {
    if (typeof obj !== "object" || obj === null) return false;

    const maybe = obj as Partial<IOSMTags>;

    return (
        typeof maybe.readValue === "function" &&
        typeof maybe.readInt === "function" &&
        typeof maybe.readFloat === "function" &&
        typeof maybe.readBool === "function" &&
        typeof maybe.has === "function" &&
        typeof maybe.toJSON === "function"
    );
}
export interface IOSMElementBase {
    type: OSMElementType;
    id: number;
    tags?: Record<string, string>;
}

export interface IOSMNode extends IOSMElementBase {
    type: "node";
    lat: number;
    lon: number;
}

export interface IOSMWay extends IOSMElementBase {
    type: "way";
    nodes: number[];
    geometry?: IGeo2[];
}

export interface IOSMRelation extends IOSMElementBase {
    type: "relation";
    members: IOSMRelationMember[];
}

export interface IOSMRelationMember {
    type: OSMElementType;
    ref: number;
    role: string;
}

export type IOSMElement = IOSMNode | IOSMWay | IOSMRelation;

export interface IOSMBounds {
    minlat: number;
    minlon: number;
    maxlat: number;
    maxlon: number;
}

export interface IOSMRoot {
    version: number;
    generator: string;
    elements: IOSMElement[];
    copyright?: string;
    attribution?: string;
    license?: string;
    bounds?: IOSMBounds;
}
