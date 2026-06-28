import * as WebIFC from 'web-ifc';

export interface IFCMeshData {
  expressID: number;
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
  color: { r: number; g: number; b: number; a: number };
  matrix: number[];
}

export interface IFCStorey {
  expressID: number;
  name: string;
  elevation: number;
}

export interface IFCSpatialNode {
  expressID: number;
  type: string;
  name: string;
  children: IFCSpatialNode[];
}

export interface IFCElementProps {
  expressID: number;
  type: string;
  name: string;
  guid: string;
  description: string;
}

type MeshCallback = (data: IFCMeshData) => void;
type ProgressCallback = (p: number) => void;

class IFCManager {
  // Main-thread IFC API — used for fast property/storey queries only
  private api: any = null;
  private _modelID = -1;
  private _initialized = false;

  // ── Init ──────────────────────────────────────────────────────────

  async init(): Promise<void> {
    if (this._initialized) return;
    this.api = new (WebIFC as any).IfcAPI();
    const base = import.meta.env.BASE_URL ?? '/';
    this.api.SetWasmPath(base);
    await this.api.Init();
    this._initialized = true;
  }

  // ── Load — streaming via Web Worker ──────────────────────────────

  async loadBuffer(
    buffer: ArrayBuffer,
    onMesh: MeshCallback,
    onProgress?: ProgressCallback,
  ): Promise<void> {
    if (!this.api) throw new Error('Not initialized — call init() first');

    // Close previous model
    if (this._modelID >= 0) {
      this.api.CloseModel(this._modelID);
      this._modelID = -1;
    }

    // Open on main thread FIRST (fast — copies data into WASM linear memory).
    // After this call the WASM has its own copy of the file data, so we can
    // safely transfer the original ArrayBuffer to the worker without losing it.
    onProgress?.(5);
    this._modelID = this.api.OpenModel(new Uint8Array(buffer));
    onProgress?.(15);

    // Determine WASM path to send to worker
    const wasmPath =
      new URL(import.meta.env.BASE_URL ?? '/', window.location.href).href;

    // Spawn worker that will do the expensive StreamAllMeshes off-thread
    const worker = new Worker(
      new URL('../workers/ifc-worker.ts', import.meta.url),
      { type: 'module' },
    );

    return new Promise<void>((resolve, reject) => {
      worker.onmessage = (e: MessageEvent) => {
        const msg = e.data as { type: string; [k: string]: any };

        switch (msg.type) {
          case 'MESH_BATCH': {
            for (const mesh of msg.meshes as IFCMeshData[]) {
              onMesh(mesh);
            }
            break;
          }
          case 'PROGRESS': {
            // Worker progress is 20-90 %; translate to overall 15-95 %
            onProgress?.(15 + Math.min(80, (msg.value - 20) * (80 / 70)));
            break;
          }
          case 'LOAD_DONE': {
            onProgress?.(100);
            worker.terminate();
            resolve();
            break;
          }
          case 'ERROR': {
            worker.terminate();
            reject(new Error(msg.message ?? 'Worker parse error'));
            break;
          }
        }
      };

      worker.onerror = (err) => {
        worker.terminate();
        reject(new Error(`IFC worker crashed: ${err.message}`));
      };

      // Transfer the buffer to the worker (zero-copy).
      // The main-thread WASM already copied the data above — the original
      // ArrayBuffer is no longer needed here.
      worker.postMessage({ type: 'LOAD', buffer, wasmPath }, [buffer]);
    });
  }

  // ── Storeys ───────────────────────────────────────────────────────

  getStoreys(): IFCStorey[] {
    if (!this.api || this._modelID < 0) return [];
    const ids = this.api.GetLineIDsWithType(
      this._modelID,
      WebIFC.IFCBUILDINGSTOREY,
    );
    const storeys: IFCStorey[] = [];
    for (let i = 0; i < ids.size(); i++) {
      const id = ids.get(i);
      try {
        const line = this.api.GetLine(this._modelID, id);
        storeys.push({
          expressID: id,
          name: line?.Name?.value ?? `Storey ${i + 1}`,
          elevation:
            typeof line?.Elevation?.value === 'number'
              ? line.Elevation.value
              : i * 3,
        });
      } catch {
        storeys.push({ expressID: id, name: `Storey ${i + 1}`, elevation: i * 3 });
      }
    }
    return storeys.sort((a, b) => a.elevation - b.elevation);
  }

  // ── Spatial tree ──────────────────────────────────────────────────

  getSpatialTree(): IFCSpatialNode {
    const getItems = (type: number, label: string): IFCSpatialNode[] => {
      if (!this.api || this._modelID < 0) return [];
      try {
        const ids = this.api.GetLineIDsWithType(this._modelID, type);
        const nodes: IFCSpatialNode[] = [];
        for (let i = 0; i < ids.size(); i++) {
          const id = ids.get(i);
          let name = `${label} ${i + 1}`;
          try {
            const line = this.api.GetLine(this._modelID, id);
            name = line?.Name?.value ?? name;
          } catch { /* ignore */ }
          nodes.push({ expressID: id, type: label, name, children: [] });
        }
        return nodes;
      } catch {
        return [];
      }
    };

    const storeys  = getItems(WebIFC.IFCBUILDINGSTOREY, 'IfcBuildingStorey');
    const buildings = getItems(WebIFC.IFCBUILDING, 'IfcBuilding').map(b => ({
      ...b, children: storeys,
    }));
    const sites = getItems(WebIFC.IFCSITE, 'IfcSite').map(s => ({
      ...s, children: buildings,
    }));
    const projects = getItems(WebIFC.IFCPROJECT, 'IfcProject');
    const proj = projects[0] ?? { expressID: 0, type: 'IfcProject', name: 'Project', children: [] };
    return { ...proj, children: sites };
  }

  // ── Element properties ────────────────────────────────────────────

  getElementProperties(expressID: number): IFCElementProps | null {
    if (!this.api || this._modelID < 0) return null;
    try {
      const typeCode = this.api.GetLineType(this._modelID, expressID);
      const typeName = this.api.GetNameFromTypeCode(typeCode) ?? 'Unknown';
      const line = this.api.GetLine(this._modelID, expressID, false);
      return {
        expressID,
        type: typeName,
        name: line?.Name?.value ?? 'Unnamed',
        guid: line?.GlobalId?.value ?? '',
        description: line?.Description?.value ?? '',
      };
    } catch {
      return null;
    }
  }

  // ── Storey → element mapping (for simulation & 2D plan) ───────────

  getStoreyElementIDs(storeyExpressID: number): number[] {
    if (!this.api || this._modelID < 0) return [];
    // IFC files can have MULTIPLE IFCRELCONTAINEDINSPATIALSTRUCTURE relations
    // pointing to the same storey — accumulate all of them.
    const collected: number[] = [];
    try {
      const relIDs = this.api.GetLineIDsWithType(
        this._modelID,
        WebIFC.IFCRELCONTAINEDINSPATIALSTRUCTURE,
      );
      for (let i = 0; i < relIDs.size(); i++) {
        const rel = this.api.GetLine(this._modelID, relIDs.get(i), false);
        if (rel?.RelatingStructure?.value !== storeyExpressID) continue;
        const elems = rel?.RelatedElements;
        if (!Array.isArray(elems)) continue;
        for (const e of elems) {
          if (typeof e?.value === 'number') collected.push(e.value);
        }
      }
    } catch { /* ignore */ }
    // Deduplicate
    return [...new Set(collected)];
  }

  /** Returns Map<storeyExpressID → expressID[]> for all storeys */
  buildStoreyElementMap(storeys: IFCStorey[]): Map<number, number[]> {
    const map = new Map<number, number[]>();
    for (const s of storeys) {
      map.set(s.expressID, this.getStoreyElementIDs(s.expressID));
    }
    return map;
  }

  // ── State ─────────────────────────────────────────────────────────

  get isLoaded(): boolean { return this._modelID >= 0; }

  closeModel(): void {
    if (this.api && this._modelID >= 0) {
      this.api.CloseModel(this._modelID);
      this._modelID = -1;
    }
  }
}

export const ifcManager = new IFCManager();
