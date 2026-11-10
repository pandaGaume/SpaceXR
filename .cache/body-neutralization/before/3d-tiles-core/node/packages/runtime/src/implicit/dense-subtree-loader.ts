import type { ISubtree } from "@spacexr/3d-tiles-core";

import type { IImplicitSubtreeLoader, IImplicitSubtreeLoadRequest, ILoadedImplicitSubtree } from "./types";

/** Virtual dense availability for regular Web Map and DEM pyramids. */
export class DenseImplicitSubtreeLoader implements IImplicitSubtreeLoader {
    public async load(request: IImplicitSubtreeLoadRequest): Promise<ILoadedImplicitSubtree> {
        if (request.signal.aborted) throw request.signal.reason;
        const hasChildSubtrees = request.coordinates.level + request.implicitTiling.subtreeLevels < request.implicitTiling.availableLevels;
        const subtree: ISubtree = {
            tileAvailability: { constant: 1 },
            ...(request.contentCount > 0
                ? {
                      contentAvailability: Array.from({ length: request.contentCount }, () => ({ constant: 1 as const })) as [
                          { constant: 1 },
                      ],
                  }
                : {}),
            childSubtreeAvailability: { constant: hasChildSubtrees ? 1 : 0 },
        };
        return { subtree };
    }
}
