import { IOSMElement, IOSMNode, IOSMWay, IOSMRelation, IOSMRelationMember, IOSMBounds, IOSMRoot } from "../osm.interfaces";
import { OSMTagSet } from "../osm.tagset";

export interface OverpassQueryOptions {
    timeoutSeconds?: number;
    bbox?: [number, number, number, number]; // [south, west, north, east]
}

export class OverpassClient {
    private readonly endpoint: string;

    constructor(endpoint: string = "https://overpass-api.de/api/interpreter") {
        this.endpoint = endpoint;
    }

    public async get(query: string, options?: OverpassQueryOptions): Promise<IOSMRoot> {
        const fullQuery = this.buildQuery(query, options);
        const response = await fetch(this.endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: `data=${encodeURIComponent(fullQuery)}`,
        });

        if (!response.ok) {
            throw new Error(`Overpass API error: ${response.statusText}`);
        }

        const json = await response.json();
        return this.mapRoot(json);
    }

    private buildQuery(query: string, options?: OverpassQueryOptions): string {
        const timeout = options?.timeoutSeconds ?? 25;

        const bboxClause = options?.bbox ? `(${options.bbox.join(",")})` : "";

        // If the query does not already contain a bounding box, append it.
        let finalQuery = query;
        if (bboxClause && !query.includes("(")) {
            finalQuery = query.replace(/;$/, "") + bboxClause + ";";
        }

        return [`[out:json][timeout:${timeout}];`, `${finalQuery}`, `out body;`, `>;`, `out skel qt;`].join("\n");
    }

    private mapRoot(json: any): IOSMRoot {
        const elements: IOSMElement[] = [];

        for (const el of json.elements) {
            const tags = el.tags ? new OSMTagSet(el.tags) : undefined;

            if (el.type === "node") {
                elements.push({
                    type: "node",
                    id: el.id,
                    lat: el.lat,
                    lon: el.lon,
                    tags,
                } as IOSMNode);
            } else if (el.type === "way") {
                elements.push({
                    type: "way",
                    id: el.id,
                    nodes: el.nodes ?? [],
                    geometry: el.geometry ?? undefined,
                    tags,
                } as IOSMWay);
            } else if (el.type === "relation") {
                elements.push({
                    type: "relation",
                    id: el.id,
                    members: el.members as IOSMRelationMember[],
                    tags,
                } as IOSMRelation);
            }
        }

        return {
            version: json.version ?? 0.6,
            generator: json.generator ?? "overpass-client",
            elements,
            bounds: json.bounds as IOSMBounds,
            copyright: json.copyright,
            attribution: json.attribution,
            license: json.license,
        };
    }
}
