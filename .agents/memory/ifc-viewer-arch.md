---
name: IFC Viewer architecture decisions
description: Key architectural patterns for the IFC viewer performance and feature implementation.
---

## Web Worker + dual-WASM pattern

For large file performance (30–100 MB):
- **Main thread**: calls `api.OpenModel(new Uint8Array(buffer))` first (fast copy into WASM memory) → then transfers the original `buffer` to the Worker (zero-copy).
- **Worker** (`src/workers/ifc-worker.ts`): runs `StreamAllMeshes` off main thread, sends `MESH_BATCH` messages with transferred ArrayBuffers, then `LOAD_DONE`.
- **Why**: `StreamAllMeshes` on WASM blocks JS for seconds; in a Worker the UI stays responsive. Main-thread WASM handles fast queries (props, storeys, tree).
- **Buffer transfer order matters**: `OpenModel()` must complete before `postMessage({buffer}, [buffer])` — after OpenModel, WASM has its own copy, so the ArrayBuffer can be safely transferred.

## requestIdleCallback for mesh queue

- `ThreeScene.queueMesh(data)` adds to `_meshQueue`, schedules `requestIdleCallback`.
- The idle processor runs within each frame's spare time (>2ms remaining) — adds up to 300 meshes per slot without causing jank.
- `finalizeLoad()` is called by home.tsx after `loadBuffer()` resolves; it sets `_loadComplete = true` and triggers `fitCamera()` when the queue drains.
- **Race condition guard**: `loadCompleteRef` in home.tsx tracks if `loadBuffer()` resolved before the canvas mounted; `onSceneReady` checks this ref and calls `finalizeLoad()` if needed.

## Storey element mapping

- `getStoreyElementIDs(storeyExpressID)` queries `IFCRELCONTAINEDINSPATIALSTRUCTURE` — MUST accumulate across ALL relations (not return on first match).
- `buildStoreyElementMap(storeys)` returns `Map<storeyExpressID, number[]>` — passed to `scene.buildStoreyElementMap()` after load.
- Used by: 2D floor plan clip planes, construction simulation visibility toggling.

## 2D Floor Plan mode

- `show2DPlan(storeyID, storeys)`: sets dual clip planes (bottom of storey + 1.2m cut height), switches to top orthographic camera, enables wireframe.
- `exit2DPlan()`: clears dual planes, restores single clip (if any), restores wireframe setting, returns to perspective.
- `_is2DPlan` flag prevents section drag tool from fighting the dual planes.

## Construction simulation

- `startSimulation()` hides all meshes, then reveals per-storey sets with `setTimeout(1800ms)` intervals.
- `_simTimer` is set to `null` both in `stopSimulation()` AND when the last storey resolves (prevents `isSimulating()` staying true forever).
- Fallback: final step makes all meshes visible regardless of mapping coverage.

## Selection highlight

- 3D click fires `onSelectCB(id)` only (NOT `this.highlight(id)`) — home.tsx `handleSelect` owns the highlight call to avoid double-highlight.
- Tree node click calls `onSelect(id)` → `handleSelect` → `scene.highlight(id)`.
- Fly-to (🎯 button in tree, `handleFlyTo`) also calls `scene.flyToElement(id)` which internally highlights.
