// IFC Web Worker — runs all WASM parsing off the main thread
// Main thread stays responsive during large file loads
import * as WebIFC from 'web-ifc';

let api: any = null;
let modelID = -1;

async function ensureInit(wasmPath: string) {
  if (api) return;
  api = new (WebIFC as any).IfcAPI();
  api.SetWasmPath(wasmPath);
  await api.Init();
}

self.onmessage = async (e: MessageEvent) => {
  const msg = e.data as { type: string; [k: string]: any };

  try {
    switch (msg.type) {
      case 'LOAD': {
        await ensureInit(msg.wasmPath);

        // Close previous model
        if (modelID >= 0) { api.CloseModel(modelID); modelID = -1; }

        modelID = api.OpenModel(new Uint8Array(msg.buffer));
        (self as any).postMessage({ type: 'PROGRESS', value: 20 });

        let count = 0;
        // Batch into groups of 100 meshes to reduce IPC overhead
        // but still stay memory-efficient via transferable buffers
        const batch: {
          expressID: number;
          positions: Float32Array;
          normals: Float32Array;
          indices: Uint32Array;
          color: { r: number; g: number; b: number; a: number };
          matrix: number[];
        }[] = [];

        const flushBatch = () => {
          if (batch.length === 0) return;
          // Collect all transferable buffers BEFORE building the message
          const transfers: ArrayBuffer[] = [];
          batch.forEach(m => {
            transfers.push(m.positions.buffer as ArrayBuffer, m.normals.buffer as ArrayBuffer, m.indices.buffer as ArrayBuffer);
          });
          // postMessage with transferables (zero-copy)
          (self as any).postMessage({ type: 'MESH_BATCH', meshes: batch.map(m => ({ ...m })) }, transfers);
          batch.length = 0;
        };

        api.StreamAllMeshes(modelID, (mesh: any) => {
          const geoms = mesh.geometries;
          for (let gi = 0; gi < geoms.size(); gi++) {
            const placed = geoms.get(gi);
            const geom = api.GetGeometry(modelID, placed.geometryExpressID);
            const rawVerts: Float32Array = api.GetVertexArray(
              geom.GetVertexData(), geom.GetVertexDataSize()
            );
            const rawIdx: Uint32Array = api.GetIndexArray(
              geom.GetIndexData(), geom.GetIndexDataSize()
            );

            const vCount = rawVerts.length / 6;
            const positions = new Float32Array(vCount * 3);
            const normals   = new Float32Array(vCount * 3);
            for (let v = 0; v < vCount; v++) {
              positions[v * 3]     = rawVerts[v * 6];
              positions[v * 3 + 1] = rawVerts[v * 6 + 1];
              positions[v * 3 + 2] = rawVerts[v * 6 + 2];
              normals[v * 3]       = rawVerts[v * 6 + 3];
              normals[v * 3 + 1]   = rawVerts[v * 6 + 4];
              normals[v * 3 + 2]   = rawVerts[v * 6 + 5];
            }

            const c = placed.color;
            batch.push({
              expressID: mesh.expressID,
              positions,
              normals,
              indices: new Uint32Array(rawIdx), // copy — rawIdx is a WASM view
              color: { r: c.x, g: c.y, b: c.z, a: c.w },
              matrix: Array.from(placed.flatTransformation),
            });

            if (batch.length >= 100) flushBatch();
          }

          count++;
          if (count % 500 === 0) {
            (self as any).postMessage({ type: 'PROGRESS', value: Math.min(90, 20 + count / 30) });
          }
        });

        flushBatch(); // flush remainder
        (self as any).postMessage({ type: 'LOAD_DONE' });
        break;
      }

      case 'CLOSE': {
        if (modelID >= 0 && api) { api.CloseModel(modelID); modelID = -1; }
        break;
      }

      default:
        break;
    }
  } catch (err: any) {
    (self as any).postMessage({ type: 'ERROR', message: err?.message ?? String(err) });
  }
};
