# IFC Viewer

A professional browser-based BIM file viewer for IFC 2x3 and IFC 4 models. No server upload required — all parsing and rendering happens locally in the browser using WebAssembly.

## Run & Operate

- `pnpm --filter @workspace/ifc-viewer run dev` — run the IFC viewer (port 18257, preview at `/`)
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, at `/api`)
- `pnpm run typecheck` — full typecheck across all packages

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Tailwind CSS, wouter
- 3D rendering: Three.js 0.184 with OrbitControls
- IFC parsing: web-ifc 0.0.77 (WebAssembly)
- WASM: `artifacts/ifc-viewer/public/web-ifc.wasm` (must be present at `/` relative to app)

## Where things live

- `artifacts/ifc-viewer/src/lib/ifc-manager.ts` — IFC API singleton (WASM init, geometry streaming, property extraction)
- `artifacts/ifc-viewer/src/lib/three-scene.ts` — Three.js scene, cameras, controls, picking, clipping
- `artifacts/ifc-viewer/src/components/` — DropZone, ViewerCanvas, Toolbar, StoreyPanel, ModelTree, PropertiesPanel
- `artifacts/ifc-viewer/src/pages/home.tsx` — main viewer layout
- `artifacts/ifc-viewer/public/web-ifc.wasm` — WASM binary (copied from node_modules at install time)

## Features

- Drag-and-drop or click-to-browse IFC file loading (`.ifc`)
- Full 3D WebGL viewer with orbit/pan/zoom controls
- Perspective, Top, Front, Side orthographic view modes
- Element selection via click → shows properties (type, name, GUID, expressID)
- Storey filter panel: lists all IfcBuildingStorey elements with elevations
- Section cut slider: horizontal clipping plane along Y axis
- Model structure tree: spatial hierarchy (Project → Site → Building → Storey)

## Architecture decisions

- web-ifc `Dispose()` is a **global WASM teardown** in v0.0.77, not per-geometry. Never call it per mesh.
- Meshes are added in 500-element chunks via `setTimeout` to avoid blocking the main thread.
- Scene init is async (dynamic import); pending meshes are queued in a ref and flushed on `onSceneReady`.
- Three.js resources (geometry, material, controls) are disposed on unmount to prevent GPU leaks.
- WASM path is set to `import.meta.env.BASE_URL` so it resolves correctly at any preview path.

## User preferences

_Populate as you build._

## Gotchas

- If web-ifc is upgraded, re-copy the WASM: `cp node_modules/.pnpm/web-ifc@VERSION/node_modules/web-ifc/web-ifc.wasm artifacts/ifc-viewer/public/`
- `GetLineIDsWithType` replaces the older `GetAllItemsOfType` in web-ifc 0.0.77
- `GetVertexArray` / `GetIndexArray` are the correct geometry extraction methods (not `GetRawFileVerts`)
