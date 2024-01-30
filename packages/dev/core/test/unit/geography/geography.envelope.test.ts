import { Envelope } from "../../../src/geography/geography.envelope";
import { Geo2 } from "../../../src/geography/geography.position";

describe('Envelope', () => {
    it('should find envelope center.', () => {
        const a = Envelope.FromPoints(
            new Geo2(45.56790960986128, 6.767578125),
            new Geo2(45.490945692627314, 6.61376953125)
        );
        const center = a?.center;
        expect(center?.lat).toEqual(45.5294276512443);
        expect(center?.lon).toEqual(6.690673828125);
        // new Envelope(new Geo3(center.lat, a.west), new Geo3(a.north, center.lon));
        const parts = Envelope.Split2(a);
        console.log(parts);
    });
});
