import { Geo2 } from "core/geography/geography.position";

/**
 * Notable locations on the Moon using selenographic coordinates (latitude, longitude).
 * Coordinates follow the IAU convention: positive latitude = north, positive longitude = east.
 */
export class MoonKnownPlaces {
    // ── Apollo Landing Sites ──
    public static ApolloLandingSites = {
        Apollo11: new Geo2(0.6744, 23.4731), // Sea of Tranquility
        Apollo12: new Geo2(-3.0128, -23.4219), // Ocean of Storms
        Apollo14: new Geo2(-3.6453, -17.4714), // Fra Mauro
        Apollo15: new Geo2(26.1322, 3.6339), // Hadley–Apennine
        Apollo16: new Geo2(-8.9734, 15.4986), // Descartes Highlands
        Apollo17: new Geo2(20.1908, 30.7653), // Taurus–Littrow
    };

    // ── Major Craters ──
    public static Craters = {
        Tycho: new Geo2(-43.31, -11.36), // Prominent ray crater
        Copernicus: new Geo2(9.62, -20.08), // Large impact crater
        Aristarchus: new Geo2(23.73, -47.49), // Brightest large crater
        Kepler: new Geo2(8.12, -38.01), // Ray crater in Oceanus Procellarum
        Plato: new Geo2(51.62, -9.38), // Dark-floored crater near Mare Imbrium
        Clavius: new Geo2(-58.41, -14.05), // One of the largest craters
        Grimaldi: new Geo2(-5.2, -68.36), // Dark-floored basin
        Theophilus: new Geo2(-11.4, 26.28), // Terraced walls crater
        Eratosthenes: new Geo2(14.47, -11.32), // South of Mare Imbrium
        Archimedes: new Geo2(29.72, -4.04), // Flooded crater in Mare Imbrium
        Ptolemaeus: new Geo2(-9.21, -1.83), // Large walled plain
        Alphonsus: new Geo2(-13.39, -2.98), // Central peak crater
        Arzachel: new Geo2(-18.21, -1.88), // Well-preserved crater
        Langrenus: new Geo2(-8.86, 60.97), // Eastern limb crater
        Petavius: new Geo2(-25.3, 60.4), // Large crater with rille
    };

    // ── Maria (Lunar Seas) ──
    public static Maria = {
        MareTranquillitatis: new Geo2(8.5, 31.4), // Sea of Tranquility
        MareSereniatis: new Geo2(28.0, 17.5), // Sea of Serenity
        MareImbrium: new Geo2(32.8, -15.6), // Sea of Showers
        MareCrisium: new Geo2(17.0, 59.1), // Sea of Crises
        MareFecunditatis: new Geo2(-7.8, 51.3), // Sea of Fertility
        MareNectaris: new Geo2(-15.2, 35.5), // Sea of Nectar
        MareHumorum: new Geo2(-24.4, -38.6), // Sea of Moisture
        MareNubium: new Geo2(-21.3, -16.6), // Sea of Clouds
        OceanusProcellarum: new Geo2(18.4, -57.4), // Ocean of Storms
        MareFrigoris: new Geo2(56.0, 1.4), // Sea of Cold
        MareMarginis: new Geo2(13.3, 86.1), // Sea of the Edge
        MareVaporum: new Geo2(13.3, 3.6), // Sea of Vapors
    };

    // ── Mountains and Ranges ──
    public static Mountains = {
        MontesApenninus: new Geo2(18.9, -3.7), // Apennine Mountains
        MontesAlpes: new Geo2(46.4, -0.8), // Lunar Alps
        MontesCaucasus: new Geo2(38.4, 10.0), // Caucasus Mountains
        MontesJura: new Geo2(47.1, -34.0), // Jura Mountains
        MontesCarpatus: new Geo2(14.5, -24.4), // Carpathian Mountains
        MonsPiton: new Geo2(40.6, -1.1), // Isolated peak in Mare Imbrium
        MonsHuygens: new Geo2(19.9, -2.9), // Tallest lunar mountain (~5500m)
        MonsHadley: new Geo2(26.5, 4.7), // Near Apollo 15 site
        MonsBradley: new Geo2(22.0, 1.0), // Apennine range
        MontesRook: new Geo2(-20.6, -82.5), // Orientale basin ring
    };

    // ── Rilles and Valleys ──
    public static RillesAndValleys = {
        RimaHadley: new Geo2(25.0, 3.0), // Sinuous rille, Apollo 15
        VallisSnelius: new Geo2(-31.1, 56.0), // Linear valley
        VallisAlpina: new Geo2(48.5, 3.2), // Alpine Valley cutting through Montes Alpes
        VallisSchroteri: new Geo2(26.2, -50.8), // Schröter's Valley, largest sinuous rille
        RimaAriadaeus: new Geo2(6.4, 14.0), // Linear rille
        RimaHyginus: new Geo2(7.8, 6.3), // Rille with central crater
    };

    // ── Exploration Candidates (Artemis / Future) ──
    public static ExplorationCandidates = {
        ShackletonCrater: new Geo2(-89.67, 0.0), // South pole, permanently shadowed
        MalabertCrater: new Geo2(10.15, -20.73), // Potential landing site
        AristarPlateau: new Geo2(25.5, -51.0), // Aristarchus Plateau
        GruithuisenDomes: new Geo2(36.3, -40.0), // Volcanic domes
        ReinerGamma: new Geo2(7.5, -59.0), // Magnetic anomaly swirl
        InaCaldera: new Geo2(18.65, 5.3), // Irregular mare patch (recent volcanism?)
    };
}
