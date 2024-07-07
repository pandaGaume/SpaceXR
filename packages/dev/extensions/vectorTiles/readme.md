# Vector Tile extension

Vector tiles make huge maps fast while offering full design flexibility. The vector tile format is the vector data equivalent of raster image tiles for web mapping, with the strengths of tiling: optimized for caching, scaling, and serving map imagery rapidly.

This [guide](https://docs.mapbox.com/data/tilesets/guides/vector-tiles-introduction/) from MapBox, describes how vector tiles work in web maps.

For the implementation, we use [Protobuf.js](https://github.com/protobufjs/protobuf.js). Initially, the design is based on a local copy of the `.proto` file, which is then compiled at runtime to build the necessary parser. This results in embedding the full Protobuf.js code into the application. We can avoid this overhead by compiling the `.proto` file at design time.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for more information.

## Acknowledgements

-   [SPACEXR](https://github.com/pandaGaume/SpaceXR.com)
-   [Mapbox](https://mapbox.com)

For more information, please contact us at [gaume@avegalaxar.com](mailto:gaume@avegalaxar.com).
