const { fromEvent, BehaviorSubject } = rxjs;
const { debounceTime, distinctUntilChanged, switchMap, filter, tap } = rxjs.operators;

const MAPBOX_TOKEN = "";
const GOOGLE_API_KEY = "";

class SearchControllerDelegate {
    onSearchResultSelected(place) {}
}

class GeocodingAPI {
    constructor(apiKey) {
        this.apiKey = apiKey;
    }

    async search(query) {
        // To be implemented by subclasses
    }
}

class MapboxGeocodingAPI extends GeocodingAPI {
    constructor() {
        super(MAPBOX_TOKEN);
    }

    async search(query) {
        const featureTypes = ["country", "region", "place"];
        const response = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?access_token=${this.apiKey}&language=fr&types=${featureTypes.join()}`);
        const result = await response.json();
        return result.features.map((feature) => ({
            name: feature.place_name,
            location: { lat: feature.center[1], lng: feature.center[0] },
            types: feature.place_type,
        }));
    }
}

class GoogleGeocodingAPI extends GeocodingAPI {
    constructor() {
        super(GOOGLE_API_KEY);
    }

    async search(query) {
        const response = await fetch(
            `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(query)}&inputtype=textquery&fields=name,geometry,type&key=${
                this.apiKey
            }&language=fr`
        );
        const result = await response.json();
        return result.candidates.map((item) => ({
            name: item.name,
            location: item.geometry.location,
            types: item.types,
        }));
    }
}

class SearchController {
    results = [];
    delegate;

    searchChange$ = new BehaviorSubject("");

    geocodingApiClient = new GoogleGeocodingAPI();

    constructor() {}

    setUp() {
        const searchInput = document.getElementById("search-input");
        const resultsContainer = document.getElementById("results-container");
        if (searchInput) {
            const searchObservable = this.searchChange$.asObservable().pipe(
                debounceTime(300),
                filter((value) => {
                    if (!value.length) {
                        resultsContainer.style.display = "none";
                        return false;
                    }
                    return true;
                }),
                distinctUntilChanged(),
                switchMap((query) => {
                    return this.geocodingApiClient.search(query);
                })
            );
            searchObservable.subscribe(
                (results) => {
                    this.setResults(results);
                },
                (error) => {
                    alert("Unable to fetch places. Reason: " + error);
                }
            );

            searchInput.addEventListener("input", (evt) => {
                const text = evt.target.value;
                this.searchChange$.next(text);
            });
            searchInput.addEventListener("focus", (evt) => {
                if (this.results?.length) {
                    resultsContainer.style.display = "block";
                }
            });
        }

        // Hide the results when clicking outside the input and results div
        document.addEventListener("click", (e) => {
            if (e.target !== searchInput && e.target !== resultsContainer) {
                resultsContainer.style.display = "none";
            }
        });
    }

    setResults(results) {
        this.results = results;
        const container = document.getElementById("results-container");
        if (results.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; color: #ddd; margin: 15px 0;">Aucun résultat.</div>
            `;
        } else {
            container.innerHTML = "";
            for (const result of results) {
                const resultItem = document.createElement("div");
                resultItem.classList.add("search-result");
                resultItem.textContent = result.name;
                resultItem.addEventListener("click", () => {
                    this.onResultClick(result);
                });
                container.appendChild(resultItem);
            }
        }
        container.style.display = "block";
    }

    onResultClick(data) {
        this.delegate?.onSearchResultSelected(data);
    }
}
