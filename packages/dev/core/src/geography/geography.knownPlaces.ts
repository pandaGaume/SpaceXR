import { Geo2 } from "./geography.position";

export class KnownPlaces {
    public static Mountains = {
        Everest: new Geo2(27.9881, 86.925), // Mount Everest, Himalayas
        K2: new Geo2(35.8808, 76.5155), // K2, Karakoram
        Kangchenjunga: new Geo2(27.7025, 88.1475), // Kangchenjunga, Himalayas
        Lhotse: new Geo2(27.9617, 86.9333), // Lhotse, Himalayas
        Makalu: new Geo2(27.8897, 87.0889), // Makalu, Himalayas
        ChoOyu: new Geo2(28.0942, 86.6608), // Cho Oyu, Himalayas
        Dhaulagiri: new Geo2(28.6967, 83.4872), // Dhaulagiri, Himalayas
        Manaslu: new Geo2(28.5494, 84.5599), // Manaslu, Himalayas
        NangaParbat: new Geo2(35.237, 74.5892), // Nanga Parbat, Himalayas
        Annapurna: new Geo2(28.5961, 83.8203), // Annapurna, Himalayas
        Matterhorn: new Geo2(45.9763, 7.6586), // Matterhorn, Alps
        MontBlanc: new Geo2(45.8326, 6.8652), // Mont Blanc, Alps
        Denali: new Geo2(63.0695, -151.0074), // Denali, Alaska
        Aconcagua: new Geo2(-32.6532, -70.0109), // Aconcagua, Andes
        Kilimanjaro: new Geo2(-3.0674, 37.3556), // Kilimanjaro, Africa
        Elbrus: new Geo2(43.3499, 42.4375), // Mount Elbrus, Caucasus
        PuncakJaya: new Geo2(-4.0751, 137.1889), // Puncak Jaya, Indonesia
    };

    public static Volcanoes = {
        Krakatoa: new Geo2(-6.102, 105.423), // Krakatoa, Indonesia
        Vesuvius: new Geo2(40.821, 14.426), // Mount Vesuvius, Italy
        Etna: new Geo2(37.751, 14.993), // Mount Etna, Italy
        MaunaLoa: new Geo2(19.475, -155.608), // Mauna Loa, Hawaii
        Kilauea: new Geo2(19.421, -155.287), // Kilauea, Hawaii
        Fuji: new Geo2(35.3606, 138.7274), // Mount Fuji, Japan
        StHelens: new Geo2(46.1912, -122.1944), // Mount St. Helens, USA
        Pinatubo: new Geo2(15.142, 120.35), // Mount Pinatubo, Philippines
        Rainier: new Geo2(46.853, -121.76), // Mount Rainier, USA
        Cotopaxi: new Geo2(-0.679, -78.438), // Cotopaxi, Ecuador
        Popocatepetl: new Geo2(19.023, -98.622), // Popocatépetl, Mexico
        Eyjafjallajokull: new Geo2(63.633, -19.621), // Eyjafjallajökull, Iceland
        Santorini: new Geo2(36.404, 25.396), // Santorini, Greece
        Kilimanjaro: new Geo2(-3.067, 37.355), // Mount Kilimanjaro, Tanzania
        Arenal: new Geo2(10.463, -84.703), // Arenal Volcano, Costa Rica
        Yellowstone: new Geo2(44.428, -110.588), // Yellowstone Caldera, USA
        Tambora: new Geo2(-8.25, 118.0), // Mount Tambora, Indonesia
        Sakurajima: new Geo2(31.593, 130.657), // Sakurajima, Japan
    };
}
