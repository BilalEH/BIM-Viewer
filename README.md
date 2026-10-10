# IFC Viewer — Browser-Based BIM Visualizer

A professional, fully **frontend-only** BIM (Building Information Modeling) viewer that runs entirely in the browser. No server, no upload, no account — just drag in your `.ifc` file and explore.

---

## Table of Contents

1. [Project Description](#1-project-description)
2. [Features](#2-features)
3. [Tech Stack](#3-tech-stack)
4. [How to Run Locally](#4-how-to-run-locally)
5. [Project Structure](#5-project-structure)
6. [How to Add New Features](#6-how-to-add-new-features)
7. [Architecture Deep-Dive](#7-architecture-deep-dive)
8. [Making It Production-Ready](#8-making-it-production-ready)
9. [Known Limitations & Gotchas](#9-known-limitations--gotchas)

---

## 1. Project Description

IFC Viewer is a **browser-based BIM model viewer** that uses WebAssembly to parse Industry Foundation Classes (IFC) files — the open standard for BIM data — directly in the browser without sending any data to a server.

**Why this matters:**
- `.ifc` files can contain sensitive architectural drawings and structural data; keeping everything local protects privacy.
- Removes the need for expensive BIM software licenses for simple model reviews.
- Works on any device with a modern browser.

**Supported file formats:** IFC 2×3 and IFC 4.

---

## 2. Features

| Feature | Description |
|---|---|
| **Drag & Drop** | Drop any `.ifc` file onto the app to load it instantly |
| **3D Visualization** | Full orbit, pan, zoom with smooth damping |
| **Storey Filter** | Filter by building floor; adjustable elevation clip plane |
| **Model Tree** | Hierarchical spatial structure (Site → Building → Storey → Space → Elements) |
| **Properties Panel** | Click any element to inspect its IFC attributes and property sets |
| **Navigation Tools** | Orbit · Pan · Zoom · First-Person walk (WASD + mouse look) |
| **Measure Tool** | Click two points → shows real-world distance in metres |
| **Section Tool** | Drag a horizontal cut plane through the model |
| **Explode Tool** | Slider to push elements apart from the model center |
| **Markup Tool** | Click a surface → type a note → orange pin annotation |
| **View Modes** | Perspective, Top, Front, Side orthographic cameras |
| **Project Timer** | Floating stopwatch with goal tracking (persists across refreshes) |

---

## 3. Tech Stack

```
Browser (no server required)
│
├── React 18              — UI component framework
├── TypeScript 5.9        — Type-safe JavaScript
├── Vite 6               — Fast build tool & dev server (ESM-native)
├── Tailwind CSS 4        — Utility-first styling
│
├── web-ifc 0.0.77        — IFC file parsing via WebAssembly (C++ compiled to WASM)
│   └── web-ifc.wasm      — The compiled WASM binary (served from /public/)
│
├── Three.js 0.184        — 3D WebGL rendering engine
│   └── OrbitControls     — Mouse-based camera interaction
│
├── Lucide React          — Icon library
├── Radix UI              — Accessible headless UI primitives
├── Wouter                — Lightweight client-side router
└── pnpm workspaces       — Monorepo package manager
```

### Why these choices?

| Choice | Reason |
|---|---|
| **web-ifc** | Only open-source, browser-native IFC parser; wraps the official IfcOpenShell C++ engine via WASM |
| **Three.js** | The de-facto standard for 3D in the browser; huge ecosystem, well-documented |
| **Vite** | Sub-second HMR, handles WASM/binary imports without config, ESM-native |
| **Tailwind** | Fast iteration on UI without context-switching to CSS files |
| **pnpm workspaces** | Keeps the IFC viewer isolated from the API server in the same repo |

---

## 4. How to Run Locally

### Prerequisites

| Tool | Minimum Version | Install |
|---|---|---|
| **Node.js** | v18 or higher | https://nodejs.org |
| **pnpm** | v9 or higher | `npm install -g pnpm` |
| **Git** | Any recent version | https://git-scm.com |

> **Why pnpm?** This project uses pnpm workspaces. npm and yarn will throw an error by design (the `preinstall` script enforces this).

---

### Step-by-Step Setup

#### Step 1 — Clone the repository

```bash
git clone <your-repo-url>
cd <repo-folder>
```

#### Step 2 — Install all dependencies

```bash
pnpm install
```

This installs packages for all workspaces (ifc-viewer, api-server, etc.) at once.

#### Step 3 — Copy the WASM binary

The IFC parser uses a WebAssembly binary that must be served as a static file:

```bash
cp node_modules/web-ifc/web-ifc.wasm artifacts/ifc-viewer/public/web-ifc.wasm
```

> **Important:** You must redo this step every time you update the `web-ifc` package version, otherwise the JS and WASM versions will mismatch and parsing will fail silently.

#### Step 4 — Start the development server

```bash
pnpm --filter @workspace/ifc-viewer run dev
```

The terminal will print something like:

```
  VITE v6.x.x  ready in 400ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: http://192.168.x.x:5173/
```

#### Step 5 — Open in browser

Navigate to `http://localhost:5173` and drag in any `.ifc` file to start.

---

### Running the Full Monorepo (optional)

If you also want the API server running:

```bash
# In terminal 1
pnpm --filter @workspace/ifc-viewer run dev

# In terminal 2
pnpm --filter @workspace/api-server run dev
```

Or from the workspace root to build everything:

```bash
pnpm run build
```

---

### Sample IFC Files (for testing)

No sample file is bundled. Free IFC files for testing:

- https://github.com/buildingSMART/Sample-Test-Files (official buildingSMART samples)
- https://www.ifcwiki.org/index.php/KIT_IFC_Examples (KIT academic examples)
- Search "IFC sample files" on GitHub

---

## 5. Project Structure

```
artifacts/ifc-viewer/
│
├── public/
│   └── web-ifc.wasm          ← WASM binary (copy from node_modules after install)
│
├── src/
│   ├── main.tsx              ← React app entry point
│   ├── App.tsx               ← Router (wouter) — maps "/" to HomePage
│   │
│   ├── lib/
│   │   ├── ifc-manager.ts    ← IFC file parsing (web-ifc WASM singleton)
│   │   ├── three-scene.ts    ← 3D scene, cameras, tool modes, all 3D logic
│   │   └── utils.ts          ← Shared helpers
│   │
│   ├── components/
│   │   ├── Toolbar.tsx       ← Top navigation bar (all 10 tools)
│   │   ├── ViewerCanvas.tsx  ← The <canvas> element wrapper
│   │   ├── SceneOverlay.tsx  ← HTML overlay (measure labels, markup pins, hints)
│   │   ├── StoreyPanel.tsx   ← Storey list + elevation slider (left sidebar)
│   │   ├── ModelTree.tsx     ← Spatial hierarchy tree (left sidebar)
│   │   ├── PropertiesPanel.tsx ← Element properties (right sidebar)
│   │   ├── ProjectTimer.tsx  ← Floating stopwatch widget
│   │   └── DropZone.tsx      ← Landing screen before a file is loaded
│   │
│   └── pages/
│       └── home.tsx          ← Root page — wires all state and callbacks together
│
├── package.json
├── vite.config.ts
└── tsconfig.json
```

---

## 6. How to Add New Features

This section shows the exact pattern for adding any new feature. The architecture is split cleanly: **`three-scene.ts` owns all 3D logic**, **React components own all UI state**.

---

### Pattern A — Adding a New Tool Mode

Example: adding a "Paint" tool that highlights hovered elements.

**Step 1: Add the mode to the type** in `three-scene.ts`:
```typescript
// Before
export type ToolMode = 'orbit' | 'pan' | 'zoom' | 'firstPerson' | 'measure' | 'section' | 'explode' | 'markup';

// After
export type ToolMode = 'orbit' | 'pan' | 'zoom' | 'firstPerson' | 'measure' | 'section' | 'explode' | 'markup' | 'paint';
```

**Step 2: Handle the mode** in `setToolMode()` in `three-scene.ts`:
```typescript
case 'paint':
  this.controls.enableRotate = false;
  this.controls.enablePan = false;
  this.canvas.style.cursor = 'cell';
  break;
```

**Step 3: Handle pointer events** in the `_onPointerDown` / `_onPointerUp` methods:
```typescript
// Inside _onPointerUp, after the drag-vs-click check:
if (this.toolMode === 'paint') {
  const hit = this._raycast(event);
  if (hit) {
    (hit.object as THREE.Mesh).material = new THREE.MeshStandardMaterial({ color: 0xff6600 });
  }
  return;
}
```

**Step 4: Add the button** to `Toolbar.tsx`:
```typescript
{ mode: 'paint', icon: <Paintbrush size={16} />, label: 'Paint' },
```

**Step 5: Wire the state** — `home.tsx` already passes `activeTool` and `handleTool` to both `Toolbar` and `ViewerCanvas`, so nothing extra is needed there.

---

### Pattern B — Adding a New Sidebar Panel

Example: adding a "Clash Detection" panel.

**Step 1: Create the component** `src/components/ClashPanel.tsx`:
```typescript
import React from 'react';

interface Clash { elementA: number; elementB: number; distance: number; }

interface ClashPanelProps {
  clashes: Clash[];
  onSelect: (expressId: number) => void;
}

export function ClashPanel({ clashes, onSelect }: ClashPanelProps) {
  return (
    <div className="p-3 text-sm text-white">
      <h3 className="font-semibold mb-2">Clashes ({clashes.length})</h3>
      {clashes.map((c, i) => (
        <div key={i} className="mb-1 cursor-pointer hover:bg-slate-700 p-1 rounded"
          onClick={() => onSelect(c.elementA)}>
          Element {c.elementA} ↔ {c.elementB} — {c.distance.toFixed(3)}m
        </div>
      ))}
    </div>
  );
}
```

**Step 2: Add clash detection logic** to `ifc-manager.ts` or a new `clash-detector.ts` lib file.

**Step 3: Add state** in `home.tsx`:
```typescript
const [clashes, setClashes] = useState<Clash[]>([]);
```

**Step 4: Render the panel** inside the sidebar in `home.tsx`.

---

### Pattern C — Adding a New Camera/View

Example: adding an isometric view.

In `three-scene.ts`, extend `setViewMode()`:
```typescript
case 'iso': {
  const d = this.modelSize * 1.5;
  this.perspCamera.position.set(d, d, d);
  this.perspCamera.lookAt(this.modelCenter);
  this.controls.target.copy(this.modelCenter);
  this.controls.update();
  break;
}
```

Then add a button to the view-mode group in `Toolbar.tsx` and extend the `ViewMode` type.

---

### Pattern D — Loading IFC Data You Haven't Used Yet

`web-ifc` exposes the full IFC schema. You can query any entity type.

```typescript
// In ifc-manager.ts — add a new method:
async getWalls(modelID: number): Promise<number[]> {
  return this.api.GetLineIDsWithType(modelID, WebIFC.IFCWALLSTANDARDCASE);
}

async getWallProperties(modelID: number, expressID: number) {
  return this.api.GetLine(modelID, expressID, true); // true = recursive
}
```

Common IFC entity types you can query:
| Constant | What it is |
|---|---|
| `WebIFC.IFCWALLSTANDARDCASE` | Standard walls |
| `WebIFC.IFCSLAB` | Floor and roof slabs |
| `WebIFC.IFCCOLUMN` | Structural columns |
| `WebIFC.IFCBEAM` | Structural beams |
| `WebIFC.IFCDOOR` | Doors |
| `WebIFC.IFCWINDOW` | Windows |
| `WebIFC.IFCSPACE` | Rooms/spaces |
| `WebIFC.IFCMATERIAL` | Material definitions |
| `WebIFC.IFCRELASSOCIATESMATERIAL` | Element-to-material relationships |

---

### Pattern E — Exporting Data

Example: export all element properties to JSON.

```typescript
// In ifc-manager.ts
async exportAllProperties(modelID: number): Promise<object[]> {
  const allLines = this.api.GetAllLines(modelID);
  const results = [];
  for (let i = 0; i < allLines.size(); i++) {
    const id = allLines.get(i);
    try {
      const props = await this.api.GetLine(modelID, id, true);
      results.push(props);
    } catch { /* some lines have no properties */ }
  }
  return results;
}
```

Then in React, trigger a download:
```typescript
const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a'); a.href = url; a.download = 'properties.json'; a.click();
```

---

## 7. Architecture Deep-Dive

### Data flow

```
IFC File (binary)
    │
    ▼
ifc-manager.ts (web-ifc WASM)
    │  parses geometry → calls onMesh(expressID, geometry, material) callback
    │  parses spatial tree → getSpatialTree()
    │  parses properties  → getElementProperties(expressID)
    │
    ▼
three-scene.ts (Three.js)
    │  receives mesh chunks via addMesh()
    │  renders to <canvas> via WebGL
    │  handles all pointer events
    │  fires: onSelect, onMeasureUpdate, onMarkupRequest, onSectionChange
    │
    ▼
home.tsx (React state)
    │  holds: activeTool, viewMode, markups, measureInfo, selectedElement
    │  passes callbacks down to ViewerCanvas and up-state to sidebars
    │
    ▼
Components (pure UI)
    Toolbar → dispatches tool changes
    StoreyPanel, ModelTree, PropertiesPanel → display IFC data
    SceneOverlay → overlays HTML labels on the 3D canvas
    ProjectTimer → independent floating widget
```

### The WASM singleton pattern

`ifc-manager.ts` holds a single `IfcAPI` instance. It is initialized once with `api.Init()` which loads the WASM module. After that, every file load calls `api.OpenModel()` which returns a `modelID` integer — all subsequent calls use that ID. **`api.Dispose()` must never be called** (it destroys the entire WASM instance, not just one model). Instead, call `api.CloseModel(modelID)` to free memory for one model.

### Mesh chunking

IFC files can contain tens of thousands of geometry pieces. Loading them all synchronously would freeze the browser. The solution: stream mesh chunks from the WASM parser, collect 500 at a time, then use `setTimeout(fn, 0)` to hand control back to the browser between batches. This keeps the UI responsive during load.

### Pointer event unification

Instead of separate `click`, `mousedown`, `mousemove` handlers (which conflict with OrbitControls), all interaction goes through `pointerdown → pointermove → pointerup`. Movement > 3px during a drag is flagged as a camera drag and the click action is suppressed. This makes every tool work correctly alongside OrbitControls.

---

## 8. Making It Production-Ready

Things to add before shipping to real users:

### Performance
- [ ] **Level of Detail (LOD)** — render simplified meshes when the camera is far away, swap to full detail when close. Three.js has `LOD` built in.
- [ ] **Frustum culling** — Three.js does this automatically, but grouping geometry into octrees improves it further for very large models.
- [ ] **Web Workers** — move IFC parsing off the main thread using a Worker. web-ifc supports this via `IfcAPI` in a Worker context. This stops all UI freezing during load.
- [ ] **Indexed geometry compression** — use `BufferGeometryUtils.mergeGeometries()` to batch draw calls for elements that share the same material.

### UX
- [ ] **Loading progress bar** — count streamed meshes vs estimated total; show a real percentage.
- [ ] **Undo/Redo for markup** — maintain a history stack in React state.
- [ ] **Keyboard shortcuts** — `O` for orbit, `P` for pan, `M` for measure, etc.
- [ ] **Touch support** — OrbitControls handles pinch-zoom, but measure and markup need touch event handling.

### Quality
- [ ] **TypeScript strict mode** — add `"strict": true` to `tsconfig.json` and fix all implicit `any` types (except intentional web-ifc casts).
- [ ] **Unit tests** — use Vitest to test `ifc-manager.ts` methods against known IFC fixture files.
- [ ] **Error boundary** — wrap the viewer in a React ErrorBoundary so a WASM crash shows a friendly message instead of a blank screen.

### Deployment
- [ ] **Static hosting** — run `pnpm --filter @workspace/ifc-viewer run build` and deploy the `dist/` folder to any static host (Vercel, Netlify, GitHub Pages, Cloudflare Pages). No server required.
- [ ] **WASM MIME type** — make sure your host sets `Content-Type: application/wasm` for `.wasm` files, or the browser will refuse to execute it.
- [ ] **CORS headers** — if you ever load IFC files from a URL (not file drop), the server hosting the IFC must allow CORS.

---

## 9. Known Limitations & Gotchas

| Issue | Explanation |
|---|---|
| **`api.Dispose()` kills the app** | In web-ifc 0.0.77, `Dispose()` is a global WASM teardown. Never call it per-geometry. Use `api.CloseModel(modelID)` to free a single model. |
| **Large files (>200MB) may crash** | Browser WASM memory is limited to ~2GB. Very large IFC files can exhaust it. A Web Worker + SharedArrayBuffer approach mitigates this. |
| **First-person requires perspective camera** | FP walk moves `perspCamera` — it is invisible if the orthographic camera is active. The app auto-switches to perspective when you select this tool. |
| **Explode effect on flat slabs** | Explode pushes meshes away from the model center based on centroid direction. Very flat horizontal elements (slabs, floors) barely move because their centroid is already at the center elevation. |
| **WASM binary must match JS version** | If you update `web-ifc` in `package.json`, re-copy the `.wasm` file from `node_modules`. Version mismatch causes silent parse failures. |
| **No IFC 4.3 support yet** | web-ifc 0.0.77 supports IFC 2×3 and IFC 4. IFC 4.3 (the newest standard) requires a newer web-ifc release. |

---

## Quick Reference

```bash
# Install
pnpm install

# Copy WASM (required after install or web-ifc version change)
cp node_modules/web-ifc/web-ifc.wasm artifacts/ifc-viewer/public/web-ifc.wasm

# Start dev server
pnpm --filter @workspace/ifc-viewer run dev

# Type-check
pnpm --filter @workspace/ifc-viewer run typecheck

# Production build
pnpm --filter @workspace/ifc-viewer run build
# → output in artifacts/ifc-viewer/dist/ (deploy this folder to any static host)
```

10-2026
