import { GeodeticSystem } from "../../geodesy/geodesy.system";
import { IDistanceProcessor } from "../../geodesy/geodesy.interfaces";
import { Nullable } from "../../types";
import { Envelope, GeoBounded } from "../geography.envelope";
import { IEnvelope } from "../geography.interfaces";
import { Geo2, Geo3 } from "../geography.position";

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

export class GPXCopyright {
    author?: Nullable<string>;
    year?: Nullable<number>;
    license?: Nullable<string>;

    // tslint:disable-next-line:no-empty
    public parse(e: Element): this {
        for (let i: number = 0; i !== e.children.length; i++) {
            const n: Element = e.children[i];
            if (n.nodeType === 1) {
                /* is element */
                switch (n.localName) {
                    case GPXDocument.TagNames.author: {
                        this.author = GPXDocument.ParseTextElement(n);
                        break;
                    }
                    case GPXDocument.TagNames.year: {
                        this.year = GPXDocument.ParseIntElement(n);
                        break;
                    }
                    case GPXDocument.TagNames.license: {
                        this.license = GPXDocument.ParseTextElement(n);
                        break;
                    }
                    default: {
                        break;
                    }
                }
            }
        }
        return this;
    }
}

export class GPXLink {
    public text?: Nullable<string>;
    public type?: Nullable<string>;

    // tslint:disable-next-line:no-empty
    public parse(e: Element): this {
        for (let i: number = 0; i !== e.children.length; i++) {
            const n: Element = e.children[i];
            if (n.nodeType === 1) {
                /* is element */
                switch (n.localName) {
                    case GPXDocument.TagNames.text: {
                        this.text = GPXDocument.ParseTextElement(n);
                        break;
                    }
                    case GPXDocument.TagNames.type: {
                        this.type = GPXDocument.ParseTextElement(n);
                        break;
                    }
                    default: {
                        break;
                    }
                }
            }
        }
        return this;
    }
}

export class GPXOwner {
    name?: Nullable<string>;
    email?: Nullable<string>;
    link?: Nullable<GPXLink>;

    public parse(e: Element): this {
        for (let i: number = 0; i !== e.children.length; i++) {
            const n: Element = e.children[i];
            if (n.nodeType === 1) {
                /* is element */
                switch (n.localName) {
                    case GPXDocument.TagNames.name: {
                        this.name = GPXDocument.ParseTextElement(n);
                        break;
                    }
                    case GPXDocument.TagNames.email: {
                        this.email = GPXDocument.ParseTextElement(n);
                        break;
                    }
                    case GPXDocument.TagNames.link: {
                        this.link = new GPXLink().parse(n);
                        break;
                    }
                    default: {
                        break;
                    }
                }
            }
        }
        return this;
    }
}

export class GPXBounds {
    minlat?: number;
    minlon?: number;
    maxlat?: number;
    maxlon?: number;

    public parse(e: Element): this {
        for (let i: number = 0; i !== e.attributes.length; i++) {
            const a: Attr = e.attributes[i];
            switch (a.localName) {
                case GPXDocument.AttributeNames.minlat: {
                    this.minlat = GPXDocument.ParseFloatAttribute(a);
                    break;
                }
                case GPXDocument.AttributeNames.minlon: {
                    this.minlat = GPXDocument.ParseFloatAttribute(a);
                    break;
                }
                case GPXDocument.AttributeNames.maxlat: {
                    this.minlat = GPXDocument.ParseFloatAttribute(a);
                    break;
                }
                case GPXDocument.AttributeNames.maxlon: {
                    this.minlat = GPXDocument.ParseFloatAttribute(a);
                    break;
                }
                default: {
                    break;
                }
            }
        }

        return this;
    }

    public toEnvelope(): Envelope {
        return Envelope.FromPoints(
            new Geo3(this.minlat ?? Geo2.LatRange.min, this.minlon ?? Geo2.LonRange.min),
            new Geo3(this.maxlat ?? Geo2.LatRange.max ?? Geo2.LatRange.min, this.maxlon ?? Geo2.LonRange.max ?? Geo2.LonRange.min)
        );
    }
}

export class GPXMetadata implements IHasGPXExtensions {
    public name?: Nullable<string>;
    public desc?: Nullable<string>;
    public author?: GPXOwner;
    public copyright?: GPXCopyright;
    public links?: GPXLink[];
    public time?: Nullable<Date>;
    public keywords?: Nullable<string>;
    public bounds?: GPXBounds;

    // tslint:disable-next-line:no-empty
    public parse(e: Element, doc: GPXDocument): this {
        for (let i: number = 0; i !== e.children.length; i++) {
            const n: Element = e.children[i];
            if (n.nodeType === 1) {
                /* is element */
                switch (n.localName) {
                    case GPXDocument.TagNames.name: {
                        this.name = GPXDocument.ParseTextElement(n);
                        break;
                    }
                    case GPXDocument.TagNames.desc: {
                        this.desc = GPXDocument.ParseTextElement(n);
                        break;
                    }
                    case GPXDocument.TagNames.author: {
                        this.author = new GPXOwner().parse(n);
                        break;
                    }
                    case GPXDocument.TagNames.copyright: {
                        this.copyright = new GPXCopyright().parse(n);
                        break;
                    }
                    case GPXDocument.TagNames.link: {
                        this.links = this.links || [];
                        this.links.push(new GPXLink().parse(n));
                        break;
                    }
                    case GPXDocument.TagNames.time: {
                        this.time = GPXDocument.ParseDateElement(n);
                        break;
                    }
                    case GPXDocument.TagNames.keywords: {
                        this.keywords = GPXDocument.ParseTextElement(n);
                        break;
                    }
                    case GPXDocument.TagNames.bounds: {
                        this.bounds = new GPXBounds().parse(n);
                        break;
                    }
                    case GPXDocument.TagNames.extensions: {
                        this.parseExtensions(n, doc);
                    }
                    default: {
                        this.parseExtension(n, doc);
                        break;
                    }
                }
            }
        }
        return this;
    }

    public parseExtensions(e: Element, doc: GPXDocument): void {
        for (let i: number = 0; i !== e.children.length; i++) {
            this.parseExtension(e.children[i], doc);
        }
    }

    public parseExtension(e: Element, doc: GPXDocument): void {
        const ext = doc.getExtension(e.namespaceURI);
        if (ext && ext.metadata) {
            ext.metadata(e, this);
        }
    }
}

export abstract class GPXItem implements IHasGPXExtensions {
    name?: Nullable<string>;
    cmt?: Nullable<string>;
    desc?: Nullable<string>;
    src?: Nullable<string>;
    links?: GPXLink[];
    type?: Nullable<string>;

    public parse(n: Element, doc: GPXDocument): this {
        switch (n.localName) {
            case GPXDocument.TagNames.name: {
                this.name = GPXDocument.ParseTextElement(n);
                break;
            }
            case GPXDocument.TagNames.cmt: {
                this.cmt = GPXDocument.ParseTextElement(n);
                break;
            }
            case GPXDocument.TagNames.desc: {
                this.desc = GPXDocument.ParseTextElement(n);
                break;
            }
            case GPXDocument.TagNames.src: {
                this.src = GPXDocument.ParseTextElement(n);
                break;
            }
            case GPXDocument.TagNames.link: {
                this.links = this.links || [];
                this.links.push(new GPXLink().parse(n));
                break;
            }
            case GPXDocument.TagNames.type: {
                this.type = GPXDocument.ParseTextElement(n);
                break;
            }
            case GPXDocument.TagNames.extensions: {
                this.parseExtensions(n, doc);
            }
            default: {
                this.parseExtension(n, doc);
                break;
            }
        }
        return this;
    }

    public parseExtensions(e: Element, doc: GPXDocument): void {
        for (let i: number = 0; i !== e.children.length; i++) {
            this.parseExtension(e.children[i], doc);
        }
    }

    public abstract parseExtension(e: Element, doc: GPXDocument): void;
}

export class GPXWaypoint extends GPXItem {
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

    public parse(e: Element, doc: GPXDocument): this {
        for (let i: number = 0; i !== e.attributes.length; i++) {
            const a = e.attributes[i];
            switch (a.localName) {
                case GPXDocument.AttributeNames.lat: {
                    this.lat = GPXDocument.ParseFloatAttribute(a);
                    break;
                }
                case GPXDocument.AttributeNames.lon: {
                    this.lon = GPXDocument.ParseFloatAttribute(a);
                    break;
                }
            }
        }

        for (let i = 0; i !== e.children.length; i++) {
            const n = e.children[i];
            if (n.nodeType === 1) {
                /* is element */
                switch (n.localName) {
                    case GPXDocument.TagNames.ele: {
                        this.ele = GPXDocument.ParseFloatElement(n);
                        break;
                    }
                    case GPXDocument.TagNames.time: {
                        this.time = GPXDocument.ParseDateElement(n);
                        break;
                    }
                    case GPXDocument.TagNames.magvar: {
                        this.magvar = GPXDocument.ParseFloatElement(n);
                        break;
                    }
                    case GPXDocument.TagNames.geoidheight: {
                        this.geoidheight = GPXDocument.ParseFloatElement(n);
                        break;
                    }
                    case GPXDocument.TagNames.sym: {
                        this.sym = GPXDocument.ParseTextElement(n);
                        break;
                    }
                    case GPXDocument.TagNames.fix: {
                        this.fix = GPXDocument.ParseTextElement(n);
                        break;
                    }
                    case GPXDocument.TagNames.sat: {
                        this.sat = GPXDocument.ParseIntElement(n);
                        break;
                    }
                    case GPXDocument.TagNames.hdop: {
                        this.hdop = GPXDocument.ParseIntElement(n);
                        break;
                    }
                    case GPXDocument.TagNames.vdop: {
                        this.vdop = GPXDocument.ParseIntElement(n);
                        break;
                    }
                    case GPXDocument.TagNames.pdop: {
                        this.pdop = GPXDocument.ParseIntElement(n);
                        break;
                    }
                    case GPXDocument.TagNames.ageofgpsdata: {
                        this.ageofgpsdata = GPXDocument.ParseIntElement(n);
                        break;
                    }
                    case GPXDocument.TagNames.dgpsid: {
                        this.dgpsid = GPXDocument.ParseIntElement(n);
                        break;
                    }
                    default: {
                        super.parse(n, doc);
                        break;
                    }
                }
            }
        }
        return this;
    }

    public parseExtension(e: Element, doc: GPXDocument): void {
        const ext = doc.getExtension(e.namespaceURI);
        if (ext && ext.waypoint) {
            ext.waypoint(e, this);
        }
    }
}

export class GPXTrackpoint extends GPXWaypoint {
    public parseExtension(e: Element, doc: GPXDocument): void {
        const ext = doc.getExtension(e.namespaceURI);
        if (ext && ext.trackpoint) {
            ext.trackpoint(e, this);
        }
    }
}

export class GPXRoutepoint extends GPXWaypoint {
    public parseExtension(e: Element, doc: GPXDocument): void {
        const ext = doc.getExtension(e.namespaceURI);
        if (ext && ext.routepoint) {
            ext.routepoint(e, this);
        }
    }
}

export class GPXRoute extends GPXItem {
    number?: Nullable<number>;
    rtepts?: GPXWaypoint[];

    public parse(e: Element, doc: GPXDocument): this {
        for (let i: number = 0; i !== e.children.length; i++) {
            const n: Element = e.children[i];
            if (n.nodeType === 1) {
                /* is element */
                switch (n.localName) {
                    case GPXDocument.TagNames.rtept: {
                        this.rtepts = this.rtepts || [];
                        this.rtepts.push(doc.createRoutepoint().parse(n, doc));
                        break;
                    }
                    case GPXDocument.TagNames.number: {
                        this.number = GPXDocument.ParseIntElement(n);
                        break;
                    }
                    default: {
                        super.parse(n, doc);
                        break;
                    }
                }
            }
        }
        return this;
    }

    public parseExtension(e: Element, doc: GPXDocument): void {
        const ext = doc.getExtension(e.namespaceURI);
        if (ext && ext.route) {
            ext.route(e, this);
        }
    }
}

export class GPXSegment implements IHasGPXExtensions {
    trkpts?: GPXWaypoint[];

    public parse(e: Element, doc: GPXDocument): this {
        for (let i: number = 0; i !== e.children.length; i++) {
            const n: Element = e.children[i];
            if (n.nodeType === 1) {
                /* is element */
                switch (n.localName) {
                    case GPXDocument.TagNames.trkpt: {
                        this.trkpts = this.trkpts || [];
                        this.trkpts.push(doc.createTrackpoint().parse(n, doc));
                        break;
                    }
                    case GPXDocument.TagNames.extensions: {
                        this.parseExtensions(n, doc);
                    }
                    default: {
                        this.parseExtension(n, doc);
                        break;
                    }
                }
            }
        }
        return this;
    }

    public parseExtensions(e: Element, doc: GPXDocument): void {
        for (let i: number = 0; i !== e.children.length; i++) {
            this.parseExtension(e.children[i], doc);
        }
    }

    public parseExtension(e: Element, doc: GPXDocument): void {
        const ext = doc.getExtension(e.namespaceURI);
        if (ext && ext.segment) {
            ext.segment(e, this);
        }
    }

    public length(system: IDistanceProcessor = GeodeticSystem.Default): number {
        let d: number = 0;
        if (this.trkpts) {
            for (let i: number = 0; i < this.trkpts.length - 1; i++) {
                const a = this.trkpts[i];
                const b = this.trkpts[i + 1];
                d += system.getDistanceFromFloat(a.lat ?? 0, a.lon ?? 0, b.lat ?? 0, b.lon ?? 0);
            }
        }
        return d;
    }
}

export class GPXTrack extends GPXItem {
    number?: Nullable<number>;
    trksegs?: GPXSegment[];

    public parse(e: Element, doc: GPXDocument): this {
        for (let i: number = 0; i !== e.children.length; i++) {
            const n: Element = e.children[i];
            if (n.nodeType === 1) {
                /* is element */
                switch (n.localName) {
                    case GPXDocument.TagNames.trkseg: {
                        this.trksegs = this.trksegs || [];
                        this.trksegs.push(doc.createSegment().parse(n, doc));
                        break;
                    }
                    case GPXDocument.TagNames.number: {
                        this.number = GPXDocument.ParseIntElement(n);
                        break;
                    }
                    default: {
                        super.parse(n, doc);
                        break;
                    }
                }
            }
        }
        return this;
    }

    public parseExtension(e: Element, doc: GPXDocument): void {
        const ext = doc.getExtension(e.namespaceURI);
        if (ext && ext.track) {
            ext.track(e, this);
        }
    }

    public length(system: IDistanceProcessor = GeodeticSystem.Default): number {
        let d: number = 0;
        if (this.trksegs) {
            for (let s of this.trksegs) {
                d += s.length(system);
            }
        }
        return d;
    }
}

export class GPXDocument extends GeoBounded implements IHasGPXExtensions {
    public static ParseIntElement = function (e: Element): Nullable<number> {
        if (!e || !e.firstChild) {
            return null;
        }
        const n = e.firstChild.nodeValue;
        return n ? Number.parseInt(n) : null;
    };

    public static ParseFloatElement = function (e: Element): Nullable<number> {
        if (!e || !e.firstChild) {
            return null;
        }
        const n = e.firstChild.nodeValue;
        return n ? Number.parseFloat(n) : null;
    };

    public static ParseTextElement = function (e: Element): Nullable<string> {
        if (!e || !e.firstChild) {
            return null;
        }
        return e.firstChild.nodeValue;
    };

    public static ParseDateElement = function (e: Element): Nullable<Date> {
        if (!e || !e.firstChild) {
            return null;
        }
        const n = e.firstChild.nodeValue;
        return n ? new Date(Date.parse(n)) : null;
    };

    public static ParseIntAttribute = function (a: Attr): number {
        return Number.parseInt(a.value);
    };

    public static ParseFloatAttribute = function (a: Attr): number {
        return Number.parseFloat(a.value);
    };

    public static ParseTextAttribute = function (a: Attr): string {
        return a.value;
    };

    public static ParseDateAttribute = function (a: Attr): Date {
        return new Date(Date.parse(a.value));
    };

    public static DefaultNamespace: string = "http://www.topografix.com/GPX/1/1";

    public static TagNames = {
        gpx: "gpx",
        metadata: "metadata",
        link: "link",
        text: "text",
        time: "time",
        trk: "trk",
        name: "name",
        trkseg: "trkseg",
        trkpt: "trkpt",
        ele: "ele",
        rte: "rte",
        rtept: "rtept",
        wpt: "wpt",
        author: "author",
        year: "year",
        license: "license",
        type: "type",
        email: "email",
        desc: "desc",
        copyright: "copyright",
        keywords: "keywords",
        bounds: "bounds",
        cmt: "cmt",
        src: "src",
        magvar: "magvar",
        geoidheight: "geoidheight",
        sym: "sym",
        fix: "fix",
        sat: "sat",
        hdop: "hdop",
        vdop: "vdop",
        pdop: "pdop",
        ageofgpsdata: "ageofgpsdata",
        dgpsid: "dgpsid",
        number: "number",
        extensions: "extensions",
    };

    public static AttributeNames = {
        lat: "lat",
        lon: "lon",
        minlat: "minlat",
        minlon: "minlon",
        maxlat: "maxlat",
        maxlon: "maxlon",
    };

    private _extensions?: Map<string, IGPXExtensions>; /* extensions by namespace */
    private _factories?: IGPXNodeFactories;
    private _meta?: GPXMetadata;
    private _waypoints?: GPXWaypoint[];
    private _tracks?: GPXTrack[];
    private _routes?: GPXRoute[];

    public constructor(doc?: XMLDocument, ...extensions: IGPXExtensions[]) {
        super();
        this.addExtensions(...extensions);
        if (doc) {
            this.parse(doc);
        }
    }

    public getExtension(namespace: Nullable<string>): Nullable<IGPXExtensions> | undefined {
        return this._extensions && namespace ? this._extensions.get(namespace) : null;
    }

    public addExtensions(...extensions: IGPXExtensions[]): void {
        if (extensions) {
            this._extensions = this._extensions || new Map<string, IGPXExtensions>();
            for (const e of extensions) {
                if (e) {
                    this._extensions.set(e.namespace, e);
                }
            }
        }
    }

    public get meta(): GPXMetadata | undefined {
        return this._meta;
    }

    public *waypoints(predicate?: (r: GPXWaypoint) => boolean): Iterable<GPXWaypoint> {
        if (!this._waypoints) return;
        for (const w of this._waypoints) {
            if (!predicate || predicate(w)) {
                yield w;
            }
        }
    }

    public *tracks(predicate?: (r: GPXTrack) => boolean): Iterable<GPXTrack> {
        if (!this._tracks) return;
        for (const t of this._tracks) {
            if (!predicate || predicate(t)) {
                yield t;
            }
        }
    }

    public *routes(predicate?: (r: GPXRoute) => boolean): Iterable<GPXRoute> {
        if (!this._routes) return;
        for (const r of this._routes) {
            if (!predicate || predicate(r)) {
                yield r;
            }
        }
    }

    public *segments(predicate?: (s: GPXSegment, t: GPXTrack) => boolean): Iterable<GPXSegment> {
        if (!this._tracks) return;
        for (const t of this._tracks) {
            if (!t.trksegs) continue;
            for (const s of t.trksegs) {
                if (!predicate || predicate(s, t)) {
                    yield s;
                }
            }
        }
    }

    public *trackpoints(predicate?: (p: GPXWaypoint, s: GPXSegment, t: GPXTrack) => boolean): IterableIterator<GPXWaypoint> {
        if (!this._tracks) return;
        for (const t of this._tracks) {
            if (!t.trksegs) continue;
            for (const s of t.trksegs) {
                if (!s.trkpts) continue;
                for (const wp of s.trkpts) {
                    if (!predicate || predicate(wp, s, t)) {
                        yield wp;
                    }
                }
            }
        }
    }

    public parse(e: XMLDocument | Element, ...extensions: IGPXExtensions[]): void {
        for (let i: number = 0; i !== e.children.length; i++) {
            const n = e.children[i];
            if (n.nodeType === 1) {
                /* is element */
                switch (n.localName) {
                    case GPXDocument.TagNames.gpx: {
                        this.parse(n);
                        break;
                    }
                    case GPXDocument.TagNames.metadata: {
                        this._meta = this.createMetadata().parse(n, this);
                        break;
                    }
                    case GPXDocument.TagNames.trk: {
                        this._tracks = this._tracks || [];
                        this._tracks.push(this.createTrack().parse(n, this));
                        break;
                    }
                    case GPXDocument.TagNames.rte: {
                        this._routes = this._routes || [];
                        this._routes.push(this.createRoute().parse(n, this));
                        break;
                    }
                    case GPXDocument.TagNames.wpt: {
                        this._waypoints = this._waypoints || [];
                        this._waypoints.push(this.createWaypoint().parse(n, this));
                        break;
                    }
                    case GPXDocument.TagNames.extensions: {
                        this.parseExtensions(n, this);
                    }
                    default: {
                        this.parseExtension(n, this);
                        break;
                    }
                }
            }
        }
    }

    public parseExtensions(e: Element, doc: GPXDocument): void {
        for (let i: number = 0; i !== e.children.length; i++) {
            this.parseExtension(e.children[i], doc);
        }
    }

    public parseExtension(e: Element, doc: GPXDocument): void {
        const ext = doc.getExtension(e.namespaceURI);
        if (ext && ext.gpx) {
            ext.gpx(e, this);
        }
    }

    public createMetadata(): GPXMetadata {
        return (this._factories && this._factories.metadata ? this._factories.metadata() : null) || new GPXMetadata();
    }

    public createWaypoint(): GPXWaypoint {
        return (this._factories && this._factories.waypoint ? this._factories.waypoint() : null) || new GPXWaypoint();
    }

    public createTrackpoint(): GPXWaypoint {
        return (this._factories && this._factories.waypoint ? this._factories.trackpoint?.() : null) || new GPXTrackpoint();
    }

    public createRoutepoint(): GPXRoutepoint {
        return (this._factories && this._factories.waypoint ? this._factories.routepoint?.() : null) || new GPXRoutepoint();
    }

    public createTrack(): GPXTrack {
        return (this._factories && this._factories.track ? this._factories.track() : null) || new GPXTrack();
    }

    public createSegment(): GPXSegment {
        return (this._factories && this._factories.segment ? this._factories.segment() : null) || new GPXSegment();
    }

    public createRoute(): GPXRoute {
        return (this._factories && this._factories.route ? this._factories.route() : null) || new GPXRoute();
    }

    public length(system: IDistanceProcessor = GeodeticSystem.Default): number {
        let d: number = 0;
        for (let t of this.tracks()) {
            d += t.length(system);
        }
        return d;
    }

    protected _buildEnvelope(b: IEnvelope): IEnvelope {
        var e = b ?? Envelope.Zero();
        for (var wp of this.trackpoints()) {
            e.addInPlace(wp.lat ?? 0, wp.lon);
        }
        return e;
    }
}
