import { Atmosphere } from './src/model.js';
import { AtmosphereOctree } from './src/octree.js';
import { WGS84 } from './src/geometry.js';
export function measureContinuity(seamBlendFraction) {
    const model = new Atmosphere({ sun: [0.1, 1, 0.2], solarSteps: 128 });
    const tree = new AtmosphereOctree(model, { seamBlendFraction, maxNodes: 30000, densityTolerance: 100, maxCellSize: 96000 });
    const eye = [WGS84.semiMajorAxis + 2000, 0, 0], x = WGS84.semiMajorAxis + 30000;
    let sameLevelMax = 0, mixedLevelMax = 0, transitions = 0, mixedTransitions = 0;
    const epsilon = 0.001;
    for (let y = -150000; y < 150000;) {
        const p = [x, y, 1000], left = tree.locate(p, [eye]);
        const boundary = left.cell.center[1] + left.cell.half;
        if (!(boundary > y + epsilon)) { y += 1; continue; }
        const a = [x, boundary - epsilon, 1000], b = [x, boundary + epsilon, 1000];
        const la = tree.locate(a, [eye]), lb = tree.locate(b, [eye]);
        if (la.cacheable && lb.cacheable && la.cell !== lb.cell) {
            const va = tree.solar(a, la), vb = tree.solar(b, lb);
            const jump = Math.max(...va.map((v, c) => Math.abs(v - vb[c])));
            if (la.cell.depth !== lb.cell.depth) { mixedLevelMax = Math.max(mixedLevelMax, jump); mixedTransitions++; }
            else sameLevelMax = Math.max(sameLevelMax, jump);
            transitions++;
        }
        y = boundary + epsilon;
    }
    return { seamBlendFraction, epsilonMeters: epsilon, transitions, mixedTransitions, sameLevelMax, mixedLevelMax };
}
if (process.argv[1]?.endsWith('continuity.js')) console.log(JSON.stringify({ raw: measureContinuity(0), continuous: measureContinuity(0.08) }, null, 2));
