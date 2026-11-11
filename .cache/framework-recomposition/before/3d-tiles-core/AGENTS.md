# AGENTS.md, 3d-tiles-core

Read this file before modifying the repository.

## Repository boundaries

- `node/` contains the TypeScript implementation and npm workspaces.
- `dotnet/` is reserved for the future .NET implementation.
- `cpp/` is reserved for the future C++ and Unreal implementation.
- Cross-language behavior belongs in `docs/`, not in language-specific comments only.

## Current scope

The core package contains serializable 3D Tiles interfaces, JSON codecs and structural validation. The runtime package contains renderer-neutral traversal and mutable streaming state behind explicit ports. The tiles package contains content-neutral tile addressing, neighbours, pyramids and HTTP sources. The raster package contains tile rasters of any meaning, imagery and elevation alike, and the dem package elevation models built on rasters. The grid package contains renderer-neutral terrain grid topologies built on the tile definitions of the tiles package.

Keep these layers separate:

1. Wire model: values that can appear in a 3D Tiles resource.
2. Codec: lossless JSON parsing and serialization.
3. Validation: diagnostics about a resource.
4. Runtime: traversal, loading and presentation lifecycle behind explicit ports.

Never add runtime fields such as parent links, loading status, scene objects or cached transforms to the wire interfaces.

All TypeScript interfaces use an uppercase `I` prefix, for example `ITileset`, `IRuntimeAdapter` and `IRuntimeMetric`.

## Node commands

Run commands from `node/`:

```bash
npm ci
npm run check
```

`check` runs formatting, lint, type checking, tests and the production build.

## Compatibility

- Preserve `extensions`, `extras` and unknown JSON members during a decode and encode round trip.
- Do not infer content type only from a file extension. 3D Tiles content URIs may omit extensions.
- Treat runtime tile keys as ephemeral. They are not stable feature or business identifiers.
- Add a positive and a negative fixture for every new validation rule.

## Release

The Node package uses `node-v*` tags. Publication is performed by the GitHub Actions release workflow with npm trusted publishing.
