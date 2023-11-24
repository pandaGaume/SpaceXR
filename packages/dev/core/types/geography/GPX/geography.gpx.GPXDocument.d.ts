import { IDistanceProcessor } from "../../geodesy/geodesy.interfaces";
import { Nullable } from "../../types";
import { GeoBounded } from "../geography.envelope";
import { IEnvelope } from "../geography.interfaces";
export interface IHasGPXExtensions {
    [key: string]: any;
    parseExtension(e: Element, doc: GPXDocument): void;
}
export interface IGPXExtensions {
    namespace: string;
    gpx?: (e: Element, target: GPXDocument) => void;
    metadata?: (e: Element, target: GPXMetadata) => void;
    waypoint?: (e: Element, target: GPXWaypoint) => void;
    track?: (e: Element, target: GPXTrack) => void;
    segment?: (e: Element, target: GPXSegment) => void;
    trackpoint?: (e: Element, target: GPXTrackpoint) => void;
    route?: (e: Element, target: GPXRoute) => void;
    routepoint?: (e: Element, target: GPXRoutepoint) => void;
}
export interface IGPXNodeFactories {
    metadata?: () => GPXMetadata;
    waypoint?: () => GPXWaypoint;
    trackpoint?: () => GPXTrackpoint;
    track?: () => GPXTrack;
    segment?: () => GPXSegment;
    route?: () => GPXRoute;
    routepoint?: () => GPXRoutepoint;
}
export declare class GPXCopyright {
    author?: Nullable<string>;
    year?: Nullable<number>;
    license?: Nullable<string>;
    parse(e: Element): this;
}
export declare class GPXLink {
    text?: Nullable<string>;
    type?: Nullable<string>;
    parse(e: Element): this;
}
export declare class GPXOwner {
    name?: Nullable<string>;
    email?: Nullable<string>;
    link?: Nullable<GPXLink>;
    parse(e: Element): this;
}
export declare class GPXBounds {
    minlat?: number;
    minlon?: number;
    maxlat?: number;
    maxlon?: number;
    parse(e: Element): this;
    toEnvelope(): IEnvelope | undefined;
}
export declare class GPXMetadata implements IHasGPXExtensions {
    name?: Nullable<string>;
    desc?: Nullable<string>;
    author?: GPXOwner;
    copyright?: GPXCopyright;
    links?: GPXLink[];
    time?: Nullable<Date>;
    keywords?: Nullable<string>;
    bounds?: GPXBounds;
    parse(e: Element, doc: GPXDocument): this;
    parseExtensions(e: Element, doc: GPXDocument): void;
    parseExtension(e: Element, doc: GPXDocument): void;
}
export declare abstract class GPXItem implements IHasGPXExtensions {
    name?: Nullable<string>;
    cmt?: Nullable<string>;
    desc?: Nullable<string>;
    src?: Nullable<string>;
    links?: GPXLink[];
    type?: Nullable<string>;
    parse(n: Element, doc: GPXDocument): this;
    parseExtensions(e: Element, doc: GPXDocument): void;
    abstract parseExtension(e: Element, doc: GPXDocument): void;
}
export declare class GPXWaypoint extends GPXItem {
    lat?: number;
    lon?: number;
    ele?: Nullable<number>;
    time?: Nullable<Date>;
    magvar?: Nullable<number>;
    geoidheight?: Nullable<number>;
    sym?: Nullable<string>;
    fix?: Nullable<string>;
    sat?: Nullable<number>;
    hdop?: Nullable<number>;
    vdop?: Nullable<number>;
    pdop?: Nullable<number>;
    ageofgpsdata?: Nullable<number>;
    dgpsid?: Nullable<number>;
    parse(e: Element, doc: GPXDocument): this;
    parseExtension(e: Element, doc: GPXDocument): void;
}
export declare class GPXTrackpoint extends GPXWaypoint {
    parseExtension(e: Element, doc: GPXDocument): void;
}
export declare class GPXRoutepoint extends GPXWaypoint {
    parseExtension(e: Element, doc: GPXDocument): void;
}
export declare class GPXRoute extends GPXItem {
    number?: Nullable<number>;
    rtepts?: GPXWaypoint[];
    parse(e: Element, doc: GPXDocument): this;
    parseExtension(e: Element, doc: GPXDocument): void;
}
export declare class GPXSegment implements IHasGPXExtensions {
    trkpts?: GPXWaypoint[];
    parse(e: Element, doc: GPXDocument): this;
    parseExtensions(e: Element, doc: GPXDocument): void;
    parseExtension(e: Element, doc: GPXDocument): void;
    length(system?: IDistanceProcessor): number;
}
export declare class GPXTrack extends GPXItem {
    number?: Nullable<number>;
    trksegs?: GPXSegment[];
    parse(e: Element, doc: GPXDocument): this;
    parseExtension(e: Element, doc: GPXDocument): void;
    length(system?: IDistanceProcessor): number;
}
export declare class GPXDocument extends GeoBounded implements IHasGPXExtensions {
    static ParseIntElement: (e: Element) => Nullable<number>;
    static ParseFloatElement: (e: Element) => Nullable<number>;
    static ParseTextElement: (e: Element) => Nullable<string>;
    static ParseDateElement: (e: Element) => Nullable<Date>;
    static ParseIntAttribute: (a: Attr) => number;
    static ParseFloatAttribute: (a: Attr) => number;
    static ParseTextAttribute: (a: Attr) => string;
    static ParseDateAttribute: (a: Attr) => Date;
    static DefaultNamespace: string;
    static TagNames: {
        gpx: string;
        metadata: string;
        link: string;
        text: string;
        time: string;
        trk: string;
        name: string;
        trkseg: string;
        trkpt: string;
        ele: string;
        rte: string;
        rtept: string;
        wpt: string;
        author: string;
        year: string;
        license: string;
        type: string;
        email: string;
        desc: string;
        copyright: string;
        keywords: string;
        bounds: string;
        cmt: string;
        src: string;
        magvar: string;
        geoidheight: string;
        sym: string;
        fix: string;
        sat: string;
        hdop: string;
        vdop: string;
        pdop: string;
        ageofgpsdata: string;
        dgpsid: string;
        number: string;
        extensions: string;
    };
    static AttributeNames: {
        lat: string;
        lon: string;
        minlat: string;
        minlon: string;
        maxlat: string;
        maxlon: string;
    };
    private _extensions?;
    private _factories?;
    private _meta?;
    private _waypoints?;
    private _tracks?;
    private _routes?;
    constructor(doc?: XMLDocument, ...extensions: IGPXExtensions[]);
    getExtension(namespace: Nullable<string>): Nullable<IGPXExtensions> | undefined;
    addExtensions(...extensions: IGPXExtensions[]): void;
    get meta(): GPXMetadata | undefined;
    waypoints(predicate?: (r: GPXWaypoint) => boolean): Iterable<GPXWaypoint>;
    tracks(predicate?: (r: GPXTrack) => boolean): Iterable<GPXTrack>;
    routes(predicate?: (r: GPXRoute) => boolean): Iterable<GPXRoute>;
    segments(predicate?: (s: GPXSegment, t: GPXTrack) => boolean): Iterable<GPXSegment>;
    trackpoints(predicate?: (p: GPXWaypoint, s: GPXSegment, t: GPXTrack) => boolean): IterableIterator<GPXWaypoint>;
    parse(e: XMLDocument | Element, ...extensions: IGPXExtensions[]): void;
    parseExtensions(e: Element, doc: GPXDocument): void;
    parseExtension(e: Element, doc: GPXDocument): void;
    createMetadata(): GPXMetadata;
    createWaypoint(): GPXWaypoint;
    createTrackpoint(): GPXWaypoint;
    createRoutepoint(): GPXRoutepoint;
    createTrack(): GPXTrack;
    createSegment(): GPXSegment;
    createRoute(): GPXRoute;
    length(system?: IDistanceProcessor): number;
    protected _buildEnvelope(b: IEnvelope): IEnvelope;
}
