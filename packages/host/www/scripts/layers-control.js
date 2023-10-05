const TileLayers = [
    {
        id: "google-streets",
        displayName: "Google Streets",
        previewPictureUrl: "https://www.thunderforest.com/images/sets/atlas-berlin-636.png",
    },
    {
        id: "google-sat",
        displayName: "Google Satellite",
        previewPictureUrl: "https://www.thunderforest.com/images/sets/landscape-snowdon-636.png",
    },
    {
        id: "google-hybrid",
        displayName: "Google Hybrid",
        previewPictureUrl: "https://www.thunderforest.com/images/sets/outdoors-seattle-636.png",
    },
    {
        id: "google-terrain",
        displayName: "Google Terrain",
        previewPictureUrl: "https://www.thunderforest.com/images/sets/transport-jfk-636.png",
    },
    // {
    //     displayName: "Mapbox Terrain V1",
    // },
    // {
    //     displayName: "Mapzen Normal",
    // },
    // {
    //     displayName: "Mapzen Terrarium",
    // },
];

class LayerControl {
    activeLayer;
    layerIndex = 0;
    layersListVisible = false;

    delegate;

    init() {
        const layersList = document.getElementById("layers-list");
        for (const layer of TileLayers) {
            const layerItem = document.createElement("div");
            layerItem.classList.add("layers-list-item");
            layerItem.innerHTML = `<img src="${layer.previewPictureUrl}" />`;
            layerItem.addEventListener("click", () => {
                this.onLayerSelected(layer);
            });
            layersList.appendChild(layerItem);
        }

        document.getElementById("layers-control").addEventListener("click", (evt) => {
            // if (this.layerIndex < TileLayers.length - 1) this.layerIndex++;
            // else this.layerIndex = 0;
            // this.delegate?.onTileLayerChange(TileLayers[this.layerIndex]);

            this.setLayersListVisible(!this.layersListVisible);
        });
    }

    setLayersListVisible(visible) {
        this.layersListVisible = visible;
        const elmnt = document.getElementById("layers-list");
        if (visible) elmnt.classList.remove("collapsed");
        else elmnt.classList.add("collapsed");
    }

    onLayerSelected(layer) {
        this.activeLayer = layer;
        this.delegate?.onTileLayerChange(layer);
    }
}
