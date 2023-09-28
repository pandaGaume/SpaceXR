const { fromEvent, BehaviorSubject } = rxjs;
const { debounceTime, distinctUntilChanged, switchMap, filter, tap } = rxjs.operators;

const MAPBOX_TOKEN = "pk.eyJ1IjoiY2xvbmdlYW5pZSIsImEiOiJjajZ3YWJ3bTQxcDk5Mnhxc29lbzMzdm54In0.-hY_qdTaIeZcZlRivs947Q";

class SearchControllerDelegate {
    onSearchResultSelected(place) {}
}

class SearchController {
    results = [];
    delegate;

    searchChange$ = new BehaviorSubject("");

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
                    return this.fetchPlaces(query);
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

    async fetchPlaces(query) {
        const response = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?access_token=${MAPBOX_TOKEN}&language=fr`);
        const result = await response.json();
        return result.features;
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
                resultItem.textContent = result.place_name;
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
