// Runs in the page of the implicit grid example, without any build: the bench injects this text. It observes the engine
// from outside and changes nothing but the camera. See ../../README.md.
window.__TERRAIN_BENCH__ = (() => {
    const example = () => window.__SPACEXR_EXAMPLE__;
    const round = (value, digits = 2) => (Number.isFinite(value) ? Number(value.toFixed(digits)) : null);
    const QUARTER_EDGES = ["N", "E", "S", "W"];

    /** Moves the camera to a time on a path. Paths follow time, not frames, so that engines fly the same path. */
    function placeCamera(camera, path, t, dt) {
        if (path.turn) {
            if (camera.frame) camera.frame.rotateHeading(path.turn * dt);
            else camera.yaw = (camera.yaw ?? 0) + path.turn * dt;
        }
        if (path.zoom) {
            const { nearest, farthest, rate } = path.zoom;
            const span = Math.log(farthest / nearest);
            const phase = (t * rate) % (2 * span);
            const radius = nearest * Math.exp(span - Math.abs(phase - span));
            if (camera.frame) camera.frame.radius = radius;
            else camera.radius = radius;
        }
        camera.poseChanged?.();
    }

    /** Flies a path and calls a function after each frame, once it is rendered. */
    function fly(path, seconds, afterFrame, beforeFrame) {
        const { camera, scene } = example();
        const observer = afterFrame ? scene.onAfterRenderObservable.add(afterFrame) : undefined;
        return new Promise((resolve) => {
            const start = performance.now();
            let last = start;
            const tick = () => {
                const now = performance.now();
                const t = (now - start) / 1000;
                placeCamera(camera, path, t, (now - last) / 1000);
                last = now;
                beforeFrame?.();
                if (t < seconds) requestAnimationFrame(tick);
                else {
                    // The path ends exactly where it should, whatever the frame rate: images at rest can be compared.
                    placeCamera(camera, path, seconds, seconds - t);
                    if (observer) scene.onAfterRenderObservable.remove(observer);
                    resolve(t);
                }
            };
            requestAnimationFrame(tick);
        });
    }

    /** Wraps methods for the time of a function and returns what they recorded. */
    async function measured(work) {
        const { terrain, scene, runtime } = example();
        const gl = scene.getEngine()._gl;
        const m = {
            frames: 0,
            terrainMs: 0,
            renderMs: 0,
            runtimeMs: 0,
            runtimeFrames: 0,
            uploadBytes: 0,
            uploadCalls: 0,
            triangles: 0,
            drawCalls: 0,
            gpuMs: 0,
            gpuSamples: 0,
            rebuilds: 0,
            identicalRebuilds: 0,
            probeMs: 0,
        };
        const restore = [];
        const wrap = (owner, name, around) => {
            const original = owner[name];
            owner[name] = function (...args) {
                return around.call(this, original, args);
            };
            restore.push(() => (owner[name] = original));
        };
        const size = (value) => (value && value.byteLength) || 0;
        const countUpload = (bytes) =>
            function (original, args) {
                m.uploadCalls++;
                m.uploadBytes += bytes(args);
                return original.apply(this, args);
            };
        wrap(
            gl,
            "bufferData",
            countUpload((a) => size(a[1])),
        );
        wrap(
            gl,
            "bufferSubData",
            countUpload((a) => size(a[2])),
        );
        wrap(
            gl,
            "texSubImage2D",
            countUpload((a) => size(a[a.length - 1])),
        );
        wrap(
            gl,
            "texSubImage3D",
            countUpload((a) => size(a[a.length - 1])),
        );
        wrap(
            gl,
            "texImage3D",
            countUpload((a) => size(a[a.length - 1])),
        );
        wrap(gl, "drawElementsInstanced", function (original, args) {
            m.drawCalls++;
            m.triangles += (args[1] / 3) * args[4];
            return original.apply(this, args);
        });
        wrap(gl, "drawElements", function (original, args) {
            m.drawCalls++;
            m.triangles += args[1] / 3;
            return original.apply(this, args);
        });
        const timed = (key) =>
            function (original, args) {
                const start = performance.now();
                const result = original.apply(this, args);
                m[key] += performance.now() - start;
                return result;
            };
        wrap(terrain, "beforeRender", timed("terrainMs"));
        // Rebuilds of the GPU engine, and those giving the cut they had: the time of this comparison is taken out of the terrain.
        if (terrain.rebuild) {
            const cutOf = () =>
                terrain.placed
                    .map(
                        ({ instance: { address, finerEdges } }) =>
                            `${address.face ?? ""}/${address.lod}/${address.x}/${address.y}:${finerEdges}`,
                    )
                    .sort()
                    .join("|");
            let lastCut = cutOf();
            wrap(terrain, "rebuild", function (original, args) {
                const result = original.apply(this, args);
                const start = performance.now();
                const cut = cutOf();
                m.rebuilds++;
                if (cut === lastCut) m.identicalRebuilds++;
                lastCut = cut;
                m.probeMs += performance.now() - start;
                return result;
            });
        }
        wrap(scene, "render", timed("renderMs"));
        wrap(runtime, "processFrame", function (original, args) {
            const start = performance.now();
            const result = original.apply(this, args);
            m.runtimeFrames++;
            return Promise.resolve(result).finally(() => (m.runtimeMs += performance.now() - start));
        });
        const gpuText = document.getElementById("frame-statistics");
        const elapsed = await work(() => {
            m.frames++;
            const gpu = gpuText?.textContent.match(/GPU ([0-9.]+) ms/);
            if (gpu) {
                m.gpuMs += Number(gpu[1]);
                m.gpuSamples++;
            }
        });
        for (const undo of restore) undo();
        return { m, elapsed };
    }

    function pyramidOf(terrain) {
        return terrain.elevation?.pyramid ?? terrain.grids?.elevation?.pyramid;
    }

    function instanceCount(terrain) {
        return terrain.placed ? terrain.placed.length : terrain.getStatistics().presented;
    }

    /** What the selection really changed, and what its passes tried, from the counters of the runtime. */
    function cutChanges() {
        const metrics = example().runtime.instrumentation?.snapshot().metrics ?? {};
        const count = (name) => metrics[name]?.count ?? 0;
        return {
            entered: count("cut.entered"),
            left: count("cut.left"),
            refines: count("tile.refine"),
            attempts: count("tile.refine.attempt"),
            cancelled: count("content.cancelled"),
        };
    }

    /** Performance of a path, without reading pixels back. */
    async function performancePass(path, seconds) {
        const intervals = [];
        let lastFrame;
        const cutBefore = cutChanges();
        const { m, elapsed } = await measured((onFrame) =>
            fly(path, seconds, () => {
                const now = performance.now();
                if (lastFrame !== undefined) intervals.push(now - lastFrame);
                lastFrame = now;
                onFrame();
            }),
        );
        const cutAfter = cutChanges();
        intervals.sort((left, right) => left - right);
        const percentile = (share) => round(intervals[Math.min(intervals.length - 1, Math.floor(intervals.length * share))] ?? 0, 1);
        const { terrain } = example();
        const statistics = terrain.getStatistics();
        const frames = Math.max(1, m.frames);
        return {
            engine: terrain.name,
            framesPerSecond: round(m.frames / elapsed, 1),
            frameMsMedian: percentile(0.5),
            frameMsP95: percentile(0.95),
            frameMsP99: percentile(0.99),
            cutEntered: cutAfter.entered - cutBefore.entered,
            cutLeft: cutAfter.left - cutBefore.left,
            cancelledLoads: cutAfter.cancelled - cutBefore.cancelled,
            refineAttempts: cutAfter.attempts - cutBefore.attempts,
            refines: cutAfter.refines - cutBefore.refines,
            rebuilds: m.rebuilds,
            identicalRebuilds: m.identicalRebuilds,
            terrainCpuMs: round((m.terrainMs - m.probeMs) / frames),
            renderCpuMs: round(m.renderMs / frames),
            runtimeFrameMs: round(m.runtimeMs / Math.max(1, m.runtimeFrames), 1),
            gpuMs: m.gpuSamples ? round(m.gpuMs / m.gpuSamples) : null,
            instances: instanceCount(terrain),
            drawCalls: round(m.drawCalls / frames, 1),
            trianglesPerFrame: Math.round(m.triangles / frames),
            uploadKiBPerFrame: round(m.uploadBytes / frames / 1024, 1),
            uploadCallsPerFrame: round(m.uploadCalls / frames, 1),
            gpuMiB: round(statistics.gpuBytes / 1048576, 1),
            cpuMiB: round(statistics.cpuBytes / 1048576, 1),
            demTiles: pyramidOf(terrain)?.size ?? 0,
        };
    }

    /** Background pixels below the terrain, in one column out of eight. */
    function holeCounter() {
        const { scene } = example();
        const engine = scene.getEngine();
        const gl = engine._gl;
        const clear = scene.clearColor;
        const background = [clear.r * 255, clear.g * 255, clear.b * 255];
        let buffer;
        return () => {
            const w = gl.drawingBufferWidth;
            const h = gl.drawingBufferHeight;
            if (!buffer || buffer.length !== w * h * 4) buffer = new Uint8Array(w * h * 4);
            gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buffer);
            let holes = 0;
            for (let x = 4; x < w; x += 8) {
                let terrainSeen = false;
                for (let y = h - 1; y >= 0; y--) {
                    const i = (y * w + x) * 4;
                    const isBackground =
                        Math.abs(buffer[i] - background[0]) < 5 &&
                        Math.abs(buffer[i + 1] - background[1]) < 5 &&
                        Math.abs(buffer[i + 2] - background[2]) < 5;
                    if (!isBackground) terrainSeen = true;
                    else if (terrainSeen) holes++;
                }
            }
            return holes;
        };
    }

    /** Whether a point on the body lies in the view of the camera. */
    function viewTest() {
        const m = example().camera.getTransformationMatrix().m;
        return (p) => {
            const x = m[0] * p.x + m[4] * p.y + m[8] * p.z + m[12];
            const y = m[1] * p.x + m[5] * p.y + m[9] * p.z + m[13];
            const w = m[3] * p.x + m[7] * p.y + m[11] * p.z + m[15];
            return w > 0 && Math.abs(x) <= w && Math.abs(y) <= w;
        };
    }

    /** Largest distance between the vertices meshes share on their edges, from their double precision geometry. */
    function meshSharedEdges(terrain) {
        const pipeline = terrain.grids;
        const scale = pipeline.currentVerticalScale;
        const points = new Map();
        const inView = viewTest();
        let shared = 0;
        let worst = 0;
        let worstVisible = 0;
        let worstPair;
        const describeVertex = (handle, u, v, height) => ({
            tile: handle.identity,
            lods: handle.lods,
            u,
            v,
            height,
            levels: pipeline.displayed.levelsAt(handle.identity, u, v),
            stale: handle.edgeLevels !== pipeline.displayed.boundarySignature(handle.identity),
        });
        for (const handle of pipeline.handles) {
            if (!handle.presented || !handle.elevated) continue;
            const { base, up, heights } = handle.elevated;
            const coordinates = pipeline.topologies.get(handle.lods).coordinates;
            for (let vertex = 0; vertex < heights.length; vertex++) {
                const u = coordinates[vertex * 2];
                const v = coordinates[vertex * 2 + 1];
                if (u !== 0 && u !== 1 && v !== 0 && v !== 1) continue;
                const height = (Number.isNaN(heights[vertex]) ? 0 : heights[vertex]) * scale;
                const x = base[vertex * 3] + up[vertex * 3] * height;
                const y = base[vertex * 3 + 1] + up[vertex * 3 + 1] * height;
                const z = base[vertex * 3 + 2] + up[vertex * 3 + 2] * height;
                const key = `${Math.round(base[vertex * 3] * 100)}/${Math.round(base[vertex * 3 + 1] * 100)}/${Math.round(base[vertex * 3 + 2] * 100)}`;
                const known = points.get(key);
                if (known && known.handle !== handle) {
                    shared++;
                    const gap = Math.hypot(known.x - x, known.y - y, known.z - z);
                    worst = Math.max(worst, gap);
                    if (inView({ x, y, z }) && gap > worstVisible) {
                        worstVisible = gap;
                        worstPair = {
                            gap,
                            a: describeVertex(handle, u, v, height),
                            b: describeVertex(known.handle, known.u, known.v, known.height),
                        };
                    }
                } else if (!known) points.set(key, { handle, u, v, height, x, y, z });
            }
        }
        return { shared, worst, worstVisible, worstPair };
    }

    /**
     * The same for GPU instances, whose edges are recomputed from their attributes as the vertex shader does, on the
     * half-cell lattice of the grid really drawn, and compared as positions.
     *
     * @param injectedGap - Metres added to one vertex really shared, to prove that the probe sees a gap.
     */
    function gpuSharedEdges(terrain, injectedGap = 0) {
        const steps = 2 * terrain.cells;
        const last = terrain.elevations.size - 1;
        const verticalScale = terrain.verticalScale.value;
        const pages = new Map();
        for (const page of terrain.elevations.pages.values())
            pages.set(page.layer, terrain.elevation?.pyramid.rasters.stitchedGrid(page.address));
        // Instances are spread over one grid per junction topology: each reads its own grid, at its own index.
        const reference = (name, index) => {
            const { grid, gridIndex } = terrain.placed[index];
            const a = grid.attribute(name);
            return [a[gridIndex * 4], a[gridIndex * 4 + 1], a[gridIndex * 4 + 2], a[gridIndex * 4 + 3]];
        };
        const elevationAt = (index, hx, hy) => {
            const north = hy === 0;
            const south = hy === steps;
            const west = hx === 0;
            const east = hx === steps;
            if (north && west) return reference("instCornerNW", index);
            if (north && east) return reference("instCornerNE", index);
            if (south && east) return reference("instCornerSE", index);
            if (south && west) return reference("instCornerSW", index);
            if (north) return reference("instEdgeN", index);
            if (east) return reference("instEdgeE", index);
            if (south) return reference("instEdgeS", index);
            if (west) return reference("instEdgeW", index);
            return reference("instElevation", index);
        };
        const heightIn = (r, u, v) => {
            if (r[3] < 0) return 0;
            const turns = Math.floor((r[3] - Math.floor(r[3])) * 4 + 0.5);
            let tu = u;
            let tv = v;
            if (turns === 1) [tu, tv] = [1 - v, u];
            else if (turns === 2) [tu, tv] = [1 - u, 1 - v];
            else if (turns === 3) [tu, tv] = [v, 1 - u];
            const x = (r[0] + tu * r[2]) * last;
            const y = (r[1] + tv * r[2]) * last;
            const bx = Math.max(0, Math.min(last - 1, Math.floor(x)));
            const by = Math.max(0, Math.min(last - 1, Math.floor(y)));
            const fx = Math.max(0, Math.min(1, x - bx));
            const fy = Math.max(0, Math.min(1, y - by));
            const grid = pages.get(Math.floor(r[3]));
            if (!grid) return Number.NaN;
            const at = (p, q) => {
                const h = grid.data[q * (last + 1) + p];
                return Number.isNaN(h) ? 0 : h;
            };
            return (at(bx, by) * (1 - fx) + at(bx + 1, by) * fx) * (1 - fy) + (at(bx, by + 1) * (1 - fx) + at(bx + 1, by + 1) * fx) * fy;
        };
        const sampled = (index, hx, hy) => heightIn(elevationAt(index, hx, hy), hx / steps, hy / steps);
        const BITS = { N: 1, E: 2, S: 4, W: 8 };
        const height = (entry, hx, hy) => {
            const finer = (edge) => (entry.instance.finerEdges & BITS[edge]) !== 0;
            if (((hy === 0 && !finer("N")) || (hy === steps && !finer("S"))) && hx & 1)
                return 0.5 * (sampled(entry.index, hx - 1, hy) + sampled(entry.index, hx + 1, hy));
            if (((hx === steps && !finer("E")) || (hx === 0 && !finer("W"))) && hy & 1)
                return 0.5 * (sampled(entry.index, hx, hy - 1) + sampled(entry.index, hx, hy + 1));
            return sampled(entry.index, hx, hy);
        };
        const surface = terrain.tiling.surface;
        const points = new Map();
        let injected = injectedGap === 0;
        let shared = 0;
        let worst = 0;
        let worstVisible = 0;
        let worstPair;
        const inView = viewTest();
        terrain.placed.forEach(({ instance }, index) => {
            const entry = { instance, index };
            for (const edge of QUARTER_EDGES) {
                for (let k = 0; k <= steps; k++) {
                    const hx = edge === "N" || edge === "S" ? k : edge === "E" ? steps : 0;
                    const hy = edge === "E" || edge === "W" ? k : edge === "S" ? steps : 0;
                    const p = surface.point(instance.address, hx / steps, hy / steps);
                    const key = `${Math.round(p.x * 100)}/${Math.round(p.y * 100)}/${Math.round(p.z * 100)}`;
                    let h = height(entry, hx, hy);
                    if (Number.isNaN(h)) continue;
                    const known = points.get(key);
                    if (known && known.index !== index && !injected) {
                        // On the first vertex shared between two instances, wherever it lies on their lattices.
                        h += injectedGap;
                        injected = true;
                    }
                    const up = surface.up(instance.address, hx / steps, hy / steps);
                    const position = {
                        x: p.x + up.x * h * verticalScale,
                        y: p.y + up.y * h * verticalScale,
                        z: p.z + up.z * h * verticalScale,
                    };
                    if (known && known.index !== index) {
                        shared++;
                        const gap = Math.hypot(known.position.x - position.x, known.position.y - position.y, known.position.z - position.z);
                        const visible = inView(p);
                        if (visible) worstVisible = Math.max(worstVisible, gap);
                        if (gap > worst) worst = gap;
                        if (visible && gap >= worstVisible && gap > 0) {
                            const other = terrain.placed[known.index].instance;
                            const describe = (i, hx2, hy2) => ({
                                address: i.address,
                                terrain: i.terrain,
                                terrainLevel: i.terrainLevel,
                                finer: i.finerEdges,
                                coarser: i.coarserEdges,
                                demOfTerrain: terrain.elevation?.pyramid.rasters.areaOf(i.terrain).ancestor,
                            });
                            worstPair = {
                                gap,
                                a: describe(instance),
                                aLattice: [hx, hy],
                                aHeight: h,
                                b: describe(other),
                                bLattice: known.lattice,
                                bHeight: known.h,
                                aReference: elevationAt(index, hx, hy),
                                bReference: elevationAt(known.index, known.lattice[0], known.lattice[1]),
                            };
                        }
                    } else if (!known) points.set(key, { index, h, position, lattice: [hx, hy] });
                }
            }
        });
        return { shared, worst, worstVisible, worstPair };
    }

    /**
     * Tiles shown and hidden while it runs. A tile shown again soon after it was hidden went back and forth between
     * levels: a camera turning one way only does not bring back a tile it has just left.
     */
    function lodActivity(terrain) {
        const QUICK_MILLISECONDS = 2000;
        const key = ({ face, lod, x, y }) => `${face ?? 0}/${lod}/${x}/${y}`;
        const hiddenAt = new Map();
        const returnsByTile = new Map();
        const history = new Map();
        const started = performance.now();
        const remember = (tile, change, node) => {
            if (!history.has(tile)) history.set(tile, []);
            const refining = example().runtime.refiningNodes;
            const state = (n) =>
                n ? `${n.visible ? "visible" : n.active ? "active" : "inactive"}${refining.has(n.id) ? " refining" : ""}` : "none";
            history.get(tile).push(`${Math.round(performance.now() - started)} ms ${change}, ${state(node)}, parent ${state(node.parent)}`);
        };
        let shown = 0;
        let hidden = 0;
        let returns = 0;
        let quickReturns = 0;
        let quickReturnsInView = 0;
        const present = terrain.present;
        const hide = terrain.hide;
        terrain.present = function (context) {
            for (const { handle } of context.resources) {
                if (handle.presented) continue;
                shown++;
                const tile = key(handle.identity);
                remember(tile, "shown", context.tile);
                const left = hiddenAt.get(tile);
                if (left === undefined) continue;
                hiddenAt.delete(tile);
                returns++;
                returnsByTile.set(tile, (returnsByTile.get(tile) ?? 0) + 1);
                if (performance.now() - left < QUICK_MILLISECONDS) {
                    quickReturns++;
                    if (context.tile.visible) quickReturnsInView++;
                }
            }
            return present.call(this, context);
        };
        terrain.hide = function (context) {
            for (const { handle } of context.resources) {
                if (!handle.presented) continue;
                hidden++;
                const tile = key(handle.identity);
                remember(tile, "hidden", context.tile);
                hiddenAt.set(tile, performance.now());
            }
            return hide.call(this, context);
        };
        return {
            changes: () => shown + hidden,
            report: () => {
                const worst = [...returnsByTile.entries()].sort((left, right) => right[1] - left[1])[0];
                return {
                    shown,
                    hidden,
                    returns,
                    quickReturns,
                    quickReturnsInView,
                    tilesReturning: returnsByTile.size,
                    ...(worst ? { mostReturns: worst[1], mostReturningTile: worst[0], mostReturningHistory: history.get(worst[0]) } : {}),
                };
            },
        };
    }

    /** Holes at every frame of a path, and shared edges a few times per second. */
    async function integrityPass(path, seconds) {
        const { terrain } = example();
        const activity = lodActivity(terrain);
        const countHoles = holeCounter();
        let frames = 0;
        let framesWithHoles = 0;
        let worstHoles = 0;
        let edgeChecks = 0;
        let worstEdge = 0;
        let worstVisibleEdge = 0;
        let sharedVertices = 0;
        let lastCheck = 0;
        let worstPair;
        const sharedEdges = () => (terrain.placed ? gpuSharedEdges(terrain) : meshSharedEdges(terrain));
        // A probe that sees nothing proves nothing: 100 m added to one shared vertex must come out.
        const probeDetects = terrain.placed ? gpuSharedEdges(terrain, 100).worst >= 99 : true;
        let scaleSum = 0;
        await fly(path, seconds, () => {
            frames++;
            scaleSum += example().motionScale?.scale ?? 1;
            const holes = countHoles();
            if (holes > 0) framesWithHoles++;
            worstHoles = Math.max(worstHoles, holes);
            const now = performance.now();
            if (now - lastCheck > 500) {
                lastCheck = now;
                const { shared, worst, worstVisible, worstPair: pair } = sharedEdges();
                edgeChecks++;
                sharedVertices += shared;
                if (worstVisible > worstVisibleEdge && pair) worstPair = pair;
                worstVisibleEdge = Math.max(worstVisibleEdge, worstVisible);
                worstEdge = Math.max(worstEdge, worst);
            }
        });
        const lod = activity.report();
        lod.meanThresholdScale = round(scaleSum / Math.max(1, frames));
        // The camera has stopped: what remains once the terrain has settled lasts.
        const stats = document.getElementById("runtime-statistics");
        const settling = performance.now();
        const { runtime, motionScale } = example();
        const settled = () =>
            / 0 pending/.test(stats?.textContent ?? "") &&
            !terrain.grids?.junctionsDirty &&
            !runtime.hasPendingWork &&
            (motionScale?.scale ?? 1) === 1;
        while (!settled() && performance.now() - settling < 60000) await new Promise((r) => setTimeout(r, 100));
        const settleSeconds = round((performance.now() - settling) / 1000, 1);
        await new Promise((r) => setTimeout(r, 500));
        const atRest = sharedEdges();
        const holesAtRest = countHoles();
        // The runtime computes nothing for a still camera by itself: frames are asked for, and the selection should not change.
        const changesBefore = activity.changes();
        for (let i = 0; i < 15; i++) {
            runtime.requestFrame();
            await new Promise((r) => setTimeout(r, 200));
        }
        lod.changesAtRest = activity.changes() - changesBefore;
        lod.presentedAtRest = terrain.getStatistics().presented;
        // What the view shows at rest: the error on screen of each selected tile, whatever path led there.
        const errors = runtime.selectedTiles.filter((tile) => tile.visible).map((tile) => tile.screenSpaceError ?? 0);
        lod.worstErrorAtRest = round(Math.max(0, ...errors));
        lod.meanErrorAtRest = round(errors.reduce((sum, value) => sum + value, 0) / Math.max(1, errors.length));
        lod.selectedAtRest = errors.length;
        lod.errorsAbove10AtRest = errors.filter((value) => value > 10).length;
        return {
            probeDetects,
            lod,
            settleSeconds,
            holesAtRest,
            worstSharedEdgeAtRestMetres: round(atRest.worstVisible, 3),
            ...(atRest.worstPair ? { worstPairAtRest: atRest.worstPair } : {}),
            frames,
            framesWithHoles,
            worstHoles,
            edgeChecks,
            sharedVerticesPerCheck: Math.round(sharedVertices / Math.max(1, edgeChecks)),
            worstSharedEdgeMetres: round(worstVisibleEdge, 3),
            worstOutOfViewEdgeMetres: round(worstEdge, 3),
            ...(worstPair ? { worstPair } : {}),
        };
    }

    return { performancePass, integrityPass, engine: () => example()?.terrain?.name };
})();
