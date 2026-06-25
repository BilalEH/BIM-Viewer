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

class IFCManager {
  private api: WebIFC.IfcAPI | null = null;
  private _modelID = -1;
  private _initialized = false;

  async init(): Promise<void> {
    if (this._initialized) return;
    this.api = new WebIFC.IfcAPI();
    const base = import.meta.env.BASE_URL ?? '/';
    (this.api as any).SetWasmPath(base);
    await (this.api as any).Init();
    this._initialized = true;
  }

  async loadBuffer(buffer: ArrayBuffer, onProgress?: (p: number) => void): Promise<IFCMeshData[]> {
    if (!this.api) throw new Error('Not initialized');
    if (this._modelID >= 0) {
      (this.api as any).CloseModel(this._modelID);
      this._modelID = -1;
    }
    onProgress?.(10);
    this._modelID = (this.api as any).OpenModel(new Uint8Array(buffer));
    onProgress?.(30);
    const meshes = this._streamMeshes(onProgress);
    onProgress?.(100);
    return meshes;
  }

  private _streamMeshes(onProgress?: (p: number) => void): IFCMeshData[] {
    if (!this.api || this._modelID < 0) return [];
    const result: IFCMeshData[] = [];
    let count = 0;

    (this.api as any).StreamAllMeshes(this._modelID, (mesh: any) => {
      const geoms = mesh.geometries;
      for (let i = 0; i < geoms.size(); i++) {
        const placed = geoms.get(i);
        const geom = (this.api as any).GetGeometry(this._modelID, placed.geometryExpressID);
        const rawVerts: Float32Array = (this.api as any).GetVertexArray(
          geom.GetVertexData(),
          geom.GetVertexDataSize(),
        );
        const rawIdx: Uint32Array = (this.api as any).GetIndexArray(
          geom.GetIndexData(),
          geom.GetIndexDataSize(),
        );

        const vertCount = rawVerts.length / 6;
        const positions = new Float32Array(vertCount * 3);
        const normals = new Float32Array(vertCount * 3);
        for (let v = 0; v < vertCount; v++) {
          positions[v * 3] = rawVerts[v * 6];
          positions[v * 3 + 1] = rawVerts[v * 6 + 1];
          positions[v * 3 + 2] = rawVerts[v * 6 + 2];
          normals[v * 3] = rawVerts[v * 6 + 3];
          normals[v * 3 + 1] = rawVerts[v * 6 + 4];
          normals[v * 3 + 2] = rawVerts[v * 6 + 5];
        }

        const c = placed.color;
        result.push({
          expressID: mesh.expressID,
          positions,
          normals,
          indices: Uint32Array.from(rawIdx),
          color: { r: c.x, g: c.y, b: c.z, a: c.w },
          matrix: Array.from(placed.flatTransformation),
        });

        // Note: do NOT call api.Dispose(geom) here — in web-ifc 0.0.77
        // Dispose() is a global WASM teardown, not per-geometry cleanup.
      }
      count++;
      if (count % 100 === 0) onProgress?.(30 + Math.min(60, count / 10));
    });

    return result;
  }

  getStoreys(): IFCStorey[] {
    if (!this.api || this._modelID < 0) return [];
    const ids = (this.api as any).GetLineIDsWithType(this._modelID, WebIFC.IFCBUILDINGSTOREY);
    const storeys: IFCStorey[] = [];
    for (let i = 0; i < ids.size(); i++) {
      const id = ids.get(i);
      try {
        const line = (this.api as any).GetLine(this._modelID, id);
        storeys.push({
          expressID: id,
          name: line?.Name?.value ?? `Storey ${i + 1}`,
          elevation: typeof line?.Elevation?.value === 'number' ? line.Elevation.value : i * 3,
        });
      } catch {
        storeys.push({ expressID: id, name: `Storey ${i + 1}`, elevation: i * 3 });
      }
    }
    return storeys.sort((a, b) => a.elevation - b.elevation);
  }

  getSpatialTree(): IFCSpatialNode {
    const getItems = (type: number, label: string): IFCSpatialNode[] => {
      if (!this.api || this._modelID < 0) return [];
      try {
        const ids = (this.api as any).GetLineIDsWithType(this._modelID, type);
        const nodes: IFCSpatialNode[] = [];
        for (let i = 0; i < ids.size(); i++) {
          const id = ids.get(i);
          let name = `${label} ${i + 1}`;
          try {
            const line = (this.api as any).GetLine(this._modelID, id);
            name = line?.Name?.value ?? name;
          } catch {}
          nodes.push({ expressID: id, type: label, name, children: [] });
        }
        return nodes;
      } catch {
        return [];
      }
    };

    const storeys = getItems(WebIFC.IFCBUILDINGSTOREY, 'IfcBuildingStorey');
    const buildings = getItems(WebIFC.IFCBUILDING, 'IfcBuilding').map(b => ({
      ...b,
      children: storeys,
    }));
    const sites = getItems(WebIFC.IFCSITE, 'IfcSite').map(s => ({
      ...s,
      children: buildings,
    }));
    const projects = getItems(WebIFC.IFCPROJECT, 'IfcProject');
    const proj = projects[0] ?? { expressID: 0, type: 'IfcProject', name: 'Project', children: [] };
    return { ...proj, children: sites };
  }

  getElementProperties(expressID: number): IFCElementProps | null {
    if (!this.api || this._modelID < 0) return null;
    try {
      const typeCode = (this.api as any).GetLineType(this._modelID, expressID);
      const typeName = (this.api as any).GetNameFromTypeCode(typeCode) ?? 'Unknown';
      const line = (this.api as any).GetLine(this._modelID, expressID, false);
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

  get isLoaded(): boolean {
    return this._modelID >= 0;
  }

  closeModel(): void {
    if (this.api && this._modelID >= 0) {
      (this.api as any).CloseModel(this._modelID);
      this._modelID = -1;
    }
  }
}

export const ifcManager = new IFCManager();
