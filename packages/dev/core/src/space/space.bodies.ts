import { Ellipsoid } from "../geodesy/geodesy.ellipsoid";
import { CelestialNodeType } from "./space.interfaces";

export interface IPlanetaryBody {
    readonly name: string;
    readonly celestialType: CelestialNodeType;
    readonly ellipsoid: Ellipsoid;
    readonly meanRadiusKm: number;
    /** Surface gravity in m/s² */
    readonly surfaceGravity: number;
}

export const SolarSystemBodies: Record<string, IPlanetaryBody> = {
    Earth: {
        name: "Earth",
        celestialType: CelestialNodeType.PLANET,
        ellipsoid: Ellipsoid.WGS84,
        meanRadiusKm: 6371,
        surfaceGravity: 9.807,
    },
    Moon: {
        name: "Moon",
        celestialType: CelestialNodeType.MOON,
        ellipsoid: Ellipsoid.FromAAndInverseF("Moon", 1738100, Infinity),
        meanRadiusKm: 1737.4,
        surfaceGravity: 1.622,
    },
    Mars: {
        name: "Mars",
        celestialType: CelestialNodeType.PLANET,
        ellipsoid: Ellipsoid.FromAAndInverseF("Mars", 3396190, 169.89),
        meanRadiusKm: 3389.5,
        surfaceGravity: 3.721,
    },
    Mercury: {
        name: "Mercury",
        celestialType: CelestialNodeType.PLANET,
        ellipsoid: Ellipsoid.FromAAndInverseF("Mercury", 2439700, Infinity),
        meanRadiusKm: 2439.7,
        surfaceGravity: 3.7,
    },
    Ceres: {
        name: "Ceres",
        celestialType: CelestialNodeType.ASTEROIDE,
        ellipsoid: Ellipsoid.FromAAndInverseF("Ceres", 476200, Infinity),
        meanRadiusKm: 476.2,
        surfaceGravity: 0.28,
    },
    Vesta: {
        name: "Vesta",
        celestialType: CelestialNodeType.ASTEROIDE,
        ellipsoid: Ellipsoid.FromAAndInverseF("Vesta", 262700, Infinity),
        meanRadiusKm: 262.7,
        surfaceGravity: 0.25,
    },
    Titan: {
        name: "Titan",
        celestialType: CelestialNodeType.MOON,
        ellipsoid: Ellipsoid.FromAAndInverseF("Titan", 2574730, Infinity),
        meanRadiusKm: 2574.7,
        surfaceGravity: 1.352,
    },
};
