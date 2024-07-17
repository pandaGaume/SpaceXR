const style = {
    layers: [
        {
            id: "landcover",
            source: "mapbox-terrain",
            sourceLayer: "landcover",
            type: "fill",
            paint: {
                color: "rgba(66,100,251, 0.3)",
                outlineColor: "rgba(66,100,251, 1)",
            },
        },
        {
            id: "hillshade",
            source: "mapbox-terrain",
            sourceLayer: "hillshade",
            type: "fill",
            paint: {
                color: "rgba(66,100,251, 0.3)",
                outlineColor: "rgba(66,100,251, 1)",
            },
        },
        {
            id: "contour",
            source: "mapbox-terrain",
            sourceLayer: "contour",
            type: "line",
            paint: {
                color: "#ffffff",
            },
        },
    ],
};
