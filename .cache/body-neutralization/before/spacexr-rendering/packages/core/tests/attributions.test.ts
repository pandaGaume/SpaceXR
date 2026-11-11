import { describe, expect, it } from "vitest";

import { CopyrightAttributions } from "../src";

describe("CopyrightAttributions", () => {
    it("orders sources by the number of presented contents citing them", () => {
        const attributions = new CopyrightAttributions();
        const published: Array<readonly string[]> = [];
        attributions.subscribe((current) => published.push(current));

        attributions.attach("a", ["Landsat", "Google"]);
        attributions.attach("b", ["Google"]);
        attributions.attach("c", ["Airbus"]);

        expect(attributions.current).toEqual(["Google", "Airbus", "Landsat"]);
        expect(published[0]).toEqual([]);

        attributions.detach("b");
        expect(attributions.current).toEqual(["Airbus", "Google", "Landsat"]);

        attributions.clear();
        expect(attributions.current).toEqual([]);
    });

    it("publishes only actual changes", () => {
        const attributions = new CopyrightAttributions();
        let publications = 0;
        attributions.subscribe(() => publications++);

        attributions.attach("a", ["Google"]);
        attributions.attach("b", ["Google"]);
        attributions.detach("missing");

        expect(publications).toBe(2);
    });
});
