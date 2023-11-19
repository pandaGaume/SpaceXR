import { Nullable } from "../../../../types";
import { IGPXExtensions } from "../../geography.gpx.GPXDocument";
export declare class GarminAddress {
    streetAddress?: Nullable<string>;
    city?: Nullable<string>;
    state?: Nullable<string>;
    country?: Nullable<string>;
    postalCode?: Nullable<string>;
    parse(e: Element): this;
}
export declare class GarminPhoneNumber {
    category?: Nullable<string>;
    value?: Nullable<string>;
    parse(e: Element): this;
}
export declare class Garmin {
    static TagNames: {
        StreetAddress: string;
        City: string;
        State: string;
        Country: string;
        PostalCode: string;
        Proximity: string;
        Temperature: string;
        Depth: string;
        DisplayMode: string;
        Categories: string;
        Address: string;
        PhoneNumber: string;
        DisplayColor: string;
    };
    static AttributeNames: {
        Category: string;
    };
    static Extension: IGPXExtensions;
}
