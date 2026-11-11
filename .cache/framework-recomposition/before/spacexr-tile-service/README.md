# SpaceXR Tile Service

Independent Cloudflare geospatial publishing instances share one modular source tree. The platform uses the SpaceXR geographic 2x1 tile matrix, explicit reference frames and datums, immutable R2 revisions and asynchronous external processing.

See [architecture](docs/ARCHITECTURE.md) and [dependency audit](docs/DEPENDENCY-AUDIT.md). The authoritative libraries are sibling checkouts during development. Build their packages before installing this workspace. Quantia provides units; the public Terrarium encoder belongs to @spacexr/dem.

The loopback planetary tile server and its Moon and Mars endpoints are described in [local tile server](docs/LOCAL_TILE_SERVER.md).

This repository contains no cloud credentials or pre-created Cloudflare resource identifiers. Scientific coverage is published only after product verification and successful ingestion. Synthetic fixtures are identified as synthetic.

## Administration

Run `npm run generate`, `npm run admin:setup`, then `npm run admin:dev` and open http://127.0.0.1:8790/. Sign in with the existing `OWNER_TOKEN` value from the ignored `.dev.vars` file. The API and frontend manage dataset declarations, 3D layers, inventory, jobs, audit events and scoped access tokens. Dataset records remain unpublished drafts; tile generation is disabled. See [administration](docs/ADMINISTRATION.md). The build serves an OpenAPI 3.1 contract at `/openapi.json`.
