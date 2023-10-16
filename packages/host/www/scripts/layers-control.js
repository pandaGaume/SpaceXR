const TileLayers = [
    {
        id: "google-sat",
        displayName: "Google Satellite",
        previewPictureUrl: "images/tile-layers/google-sat.png",
    },
    {
        id: "google-terrain",
        displayName: "Google Terrain",
        previewPictureUrl: "images/tile-layers/google-terrain.png",
    },
    {
        id: "mapbox-vintage",
        displayName: "Vintage",
        previewPictureUrl: "images/tile-layers/mapbox-vintage.png",
    },
    {
        id: "mapbox-hillshading",
        displayName: "Hill shading",
        previewPictureUrl: "images/tile-layers/mapbox-hill-shading.png",
    },
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
            layerItem.innerHTML = `<img src="${layer.previewPictureUrl}" />
            <div class="colored-overlay"></div>`;
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
