import { Nullable } from "../../../../types";
import { GPXDocument, IGPXExtensions } from "../../geography.gpx.GPXDocument";

export class GarminAddress {
    public streetAddress?: Nullable<string>;
    public city?: Nullable<string>;
    public state?: Nullable<string>;
    public country?: Nullable<string>;
    public postalCode?: Nullable<string>;

    public parse(e: Element): this {
        for (let i: number = 0; i !== e.children.length; i++) {
            const n: Element = e.children[i];
            if (n.nodeType === 1) {
                /* is element */
                switch (n.localName) {
                    case Garmin.TagNames.StreetAddress: {
                        this.streetAddress = GPXDocument.ParseTextElement(n);
                        break;
                    }
                    case Garmin.TagNames.City: {
                        this.city = GPXDocument.ParseTextElement(n);
                        break;
                    }
                    case Garmin.TagNames.State: {
                        this.state = GPXDocument.ParseTextElement(n);
                        break;
                    }
                    case Garmin.TagNames.Country: {
                        this.country = GPXDocument.ParseTextElement(n);
                        break;
                    }
                    case Garmin.TagNames.PostalCode: {
                        this.postalCode = GPXDocument.ParseTextElement(n);
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

export class GarminPhoneNumber {
    public category?: Nullable<string>;
    public value?: Nullable<string>;

    public parse(e: Element): this {
        for (let i: number = 0; i !== e.attributes.length; i++) {
            const a: Attr = e.attributes[i];
            switch (a.localName) {
                case Garmin.AttributeNames.Category: {
                    this.category = GPXDocument.ParseTextAttribute(a);
                    break;
                }
            }
        }
        this.value = GPXDocument.ParseTextElement(e);
        return this;
    }
}

export class Garmin {
    public static TagNames = {
        StreetAddress: "StreetAddress",
        City: "City",
        State: "State",
        Country: "Country",
        PostalCode: "PostalCode",
        Proximity: "Proximity",
        Temperature: "Temperature",
        Depth: "Depth",
        DisplayMode: "DisplayMode",
        Categories: "Categories",
        Address: "Address",
        PhoneNumber: "PhoneNumber",
        DisplayColor: "DisplayColor",
    };

    public static AttributeNames = {
        Category: "Category",
    };

    public static Extension: IGPXExtensions = {
        namespace: "http://www.garmin.com/xmlschemas/GpxExtensions/v3",
        waypoint: function (e: Element, target: any): void {
            switch (e.localName) {
                case Garmin.TagNames.Proximity: {
                    target[e.localName] = GPXDocument.ParseFloatElement(e);
                    break;
                }
                case Garmin.TagNames.Temperature: {
                    target[e.localName] = GPXDocument.ParseFloatElement(e);
                    break;
                }
                case Garmin.TagNames.Depth: {
                    target[e.localName] = GPXDocument.ParseFloatElement(e);
                    break;
                }
                case Garmin.TagNames.DisplayMode: {
                    target[e.localName] = GPXDocument.ParseTextElement(e);
                    break;
                }
                case Garmin.TagNames.Address: {
                    target[e.localName] = new GarminAddress().parse(e);
                    break;
                }
                case Garmin.TagNames.PhoneNumber: {
                    target[e.localName] = new GarminPhoneNumber().parse(e);
                    break;
                }
                default:
                    break;
            }
        },
        route: function (e: Element, target: any): void {
            switch (e.localName) {
                case Garmin.TagNames.DisplayColor: {
                    target[e.localName] = GPXDocument.ParseTextElement(e);
                    break;
                }
                default:
                    break;
            }
        },
        track: function (e: Element, target: any): void {
            switch (e.localName) {
                case Garmin.TagNames.DisplayColor: {
                    target[e.localName] = GPXDocument.ParseTextElement(e);
                    break;
                }
                default:
                    break;
            }
        },
        trackpoint: function (e: Element, target: any): void {
            switch (e.localName) {
                case Garmin.TagNames.Temperature: {
                    target[e.localName] = GPXDocument.ParseFloatElement(e);
                    break;
                }
                case Garmin.TagNames.Depth: {
                    target[e.localName] = GPXDocument.ParseFloatElement(e);
                    break;
                }
                default:
                    break;
            }
        },
    };
}
