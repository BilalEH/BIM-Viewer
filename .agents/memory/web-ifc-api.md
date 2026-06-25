---
name: web-ifc 0.0.77 API quirks
description: Critical non-obvious behaviors of web-ifc 0.0.77 that differ from older docs or intuition.
---

## Key rules

- `api.Dispose()` is a **global WASM teardown** — it closes all models and invalidates the WASM module. Never call it per-geometry inside `StreamAllMeshes`. There is no per-geometry cleanup call needed.
- Geometry extraction: use `api.GetVertexArray(geom.GetVertexData(), geom.GetVertexDataSize())` and `api.GetIndexArray(geom.GetIndexData(), geom.GetIndexDataSize())`. The old `GetRawFileVerts` does not exist in 0.0.77.
- Storey/type queries: use `api.GetLineIDsWithType(modelID, WebIFC.IFCBUILDINGSTOREY)` — returns a size-able collection with `.size()` and `.get(i)`. The old `GetAllItemsOfType` is replaced.
- Line properties: `api.GetLine(modelID, expressID)` returns an object where string values are wrapped: `line.Name.value`, `line.GlobalId.value`, `line.Elevation.value`.
- Type name from code: `api.GetNameFromTypeCode(api.GetLineType(modelID, expressID))`.
- WASM file must be served at the app's base URL root. Set with `api.SetWasmPath(import.meta.env.BASE_URL)`.

**Why:** The Dispose() misuse terminated WASM mid-parse on first load; the GetRawFileVerts misuse would have thrown at runtime.

**How to apply:** Any time web-ifc is used in this project, follow these exact API calls. If web-ifc is upgraded, re-verify these names against the new package's prototype methods.
