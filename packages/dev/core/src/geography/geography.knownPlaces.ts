import { IGeo2 } from "./geography.interfaces";
import { Geo2 } from "./geography.position";

export class KnownPlaces {
    public static FillSelectElement(select: HTMLSelectElement, places: any, callback: (name: string, geo: IGeo2) => void): HTMLSelectElement {
        const unselectedOption = document.createElement("option");
        unselectedOption.value = "";
        unselectedOption.disabled = true;
        unselectedOption.selected = true;
        unselectedOption.textContent = "Select a location...";
        select.appendChild(unselectedOption);
        for (const [category, locations] of Object.entries(places)) {
            const optgroup = document.createElement("optgroup");
            optgroup.label = category;
            // Convert the object into an array of entries
            const entries = Object.entries(<any>locations);
            // Sort the entries alphabetically by the key
            const sortedEntries = entries.sort((a, b) => a[0].localeCompare(b[0]));
            for (const [name, coords] of sortedEntries) {
                const option = document.createElement("option");
                option.value = Geo2.ToString(coords as IGeo2);
                option.text = name;
                optgroup.appendChild(option);
            }

            select.appendChild(optgroup);
        }
        select.onchange = () => {
            const selectedOption = select.options[select.selectedIndex];
            const coords: IGeo2 = Geo2.Parse(selectedOption.value);
            callback(selectedOption.text, coords);
        };
        return select;
    }

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
        Roraima: new Geo2(5.125, -60.75), // Mount Roraima, Guiana Highlands
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

    public static SightsAndParks = {
        GrandCanyon: new Geo2(36.1069, -112.1129), // Grand Canyon, USA
        Yellowstone: new Geo2(44.428, -110.5885), // Yellowstone National Park, USA
        GreatBarrierReef: new Geo2(-18.2871, 147.6992), // Great Barrier Reef, Australia
        Yosemite: new Geo2(37.8651, -119.5383), // Yosemite National Park, USA
        Serengeti: new Geo2(-2.3333, 34.8333), // Serengeti National Park, Tanzania
        MachuPicchu: new Geo2(-13.1631, -72.545), // Machu Picchu, Peru
        Banff: new Geo2(51.1784, -115.5708), // Banff National Park, Canada
        Galapagos: new Geo2(-0.9538, -90.9656), // Galapagos Islands, Ecuador
        TorresDelPaine: new Geo2(-51.1667, -73.2425), // Torres del Paine National Park, Chile
        PlitviceLakes: new Geo2(44.8803, 15.6161), // Plitvice Lakes National Park, Croatia
        VictoriaFalls: new Geo2(-17.9243, 25.8573), // Victoria Falls, Zimbabwe/Zambia
        Santorini: new Geo2(36.3932, 25.4615), // Santorini, Greece
        Petra: new Geo2(30.3285, 35.4444), // Petra, Jordan
        IguazuFalls: new Geo2(-25.6953, -54.4367), // Iguazu Falls, Argentina/Brazil
        Kruger: new Geo2(-23.9884, 31.5547), // Kruger National Park, South Africa
        BryceCanyon: new Geo2(37.593, -112.1871), // Bryce Canyon National Park, USA
        CliffsOfMoher: new Geo2(52.9715, -9.4265), // Cliffs of Moher, Ireland
        AngkorWat: new Geo2(13.4125, 103.8669), // Angkor Wat, Cambodia
        HaLongBay: new Geo2(20.9101, 107.1839), // Ha Long Bay, Vietnam
    };
}
