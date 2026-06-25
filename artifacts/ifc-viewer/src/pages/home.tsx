import { useState, useRef, useCallback, useEffect } from 'react';
import type * as THREE from 'three';
import { DropZone } from '@/components/DropZone';
import { ViewerCanvas } from '@/components/ViewerCanvas';
import { Toolbar } from '@/components/Toolbar';
import { StoreyPanel } from '@/components/StoreyPanel';
import { ModelTree } from '@/components/ModelTree';
import { PropertiesPanel } from '@/components/PropertiesPanel';
import { ProjectTimer } from '@/components/ProjectTimer';
import { SceneOverlay } from '@/components/SceneOverlay';
import {
  ifcManager,
  type IFCSpatialNode,
  type IFCStorey,
  type IFCElementProps,
  type IFCMeshData,
} from '@/lib/ifc-manager';
import type { ThreeScene, ViewMode, ToolMode, MeasureInfo, MarkupItem } from '@/lib/three-scene';

export default function Home() {
  const sceneRef = useRef<ThreeScene | null>(null);
  const pendingMeshesRef = useRef<IFCMeshData[] | null>(null);

  // ── Core state ─────────────────────────────────────────────────
  const [hasModel, setHasModel] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError]       = useState<string | null>(null);

  // ── Camera / view state ────────────────────────────────────────
  const [viewMode, setViewMode] = useState<ViewMode>('perspective');
  const [activeTool, setActiveTool] = useState<ToolMode>('orbit');

  // ── Model data ─────────────────────────────────────────────────
  const [storeys, setStoreys] = useState<IFCStorey[]>([]);
  const [tree, setTree]       = useState<IFCSpatialNode | null>(null);
  const [clipElevation, setClipElevation] = useState<number | null>(null);

  // ── Selection state ────────────────────────────────────────────
  const [selectedID, setSelectedID]       = useState(-1);
  const [selectedProps, setSelectedProps] = useState<IFCElementProps | null>(null);

  // ── Panel state ────────────────────────────────────────────────
  const [showTree, setShowTree]   = useState(true);
  const [showTimer, setShowTimer] = useState(false);

  // ── Explode ────────────────────────────────────────────────────
  const [explodeScale, setExplodeScale] = useState(0);

  // ── Measure ────────────────────────────────────────────────────
  const [measureInfo, setMeasureInfo] = useState<MeasureInfo>({
    pointA: null, pointB: null, distance: null,
  });

  // ── Markup ─────────────────────────────────────────────────────
  const [markups, setMarkups]               = useState<MarkupItem[]>([]);
  const [pendingMarkupPos, setPendingMarkupPos] = useState<THREE.Vector3 | null>(null);

  // ── Scene ready callback (flush pending meshes) ────────────────
  const onSceneReady = useCallback((scene: ThreeScene) => {
    if (pendingMeshesRef.current) {
      scene.addMeshes(pendingMeshesRef.current);
      pendingMeshesRef.current = null;
    }
  }, []);

  // ── Pre-init IFC WASM ──────────────────────────────────────────
  useEffect(() => {
    ifcManager.init().catch(() => {/* silent */});
  }, []);

  // ── File load ──────────────────────────────────────────────────
  const loadFile = useCallback(async (file: File) => {
    setLoading(true);
    setProgress(0);
    setError(null);
    setSelectedID(-1);
    setSelectedProps(null);
    setClipElevation(null);
    setExplodeScale(0);
    setMeasureInfo({ pointA: null, pointB: null, distance: null });
    setMarkups([]);
    setPendingMarkupPos(null);
    pendingMeshesRef.current = null;

    try {
      await ifcManager.init();
      setProgress(5);
      const buffer = await file.arrayBuffer();
      const meshes = await ifcManager.loadBuffer(buffer, setProgress);

      const scene = sceneRef.current;
      if (scene) {
        scene.clearMeshes();
        scene.addMeshes(meshes);
      } else {
        pendingMeshesRef.current = meshes;
      }

      setStoreys(ifcManager.getStoreys());
      setTree(ifcManager.getSpatialTree());
      setHasModel(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load IFC file.');
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Selection ──────────────────────────────────────────────────
  const handleSelect = useCallback((id: number) => {
    setSelectedID(id);
    setSelectedProps(ifcManager.getElementProperties(id));
    sceneRef.current?.highlight(id);
  }, []);

  // ── Camera ─────────────────────────────────────────────────────
  const handleViewMode = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    sceneRef.current?.setViewMode(mode);
  }, []);

  const handleHome = useCallback(() => {
    sceneRef.current?.fitCamera();
    sceneRef.current?.setViewMode('perspective');
    setViewMode('perspective');
  }, []);

  const handleFit = useCallback(() => {
    sceneRef.current?.fitCamera();
  }, []);

  // ── Tool mode ──────────────────────────────────────────────────
  const handleTool = useCallback((mode: ToolMode) => {
    setActiveTool(mode);
    // First-person internally forces perspective camera — keep React state in sync
    if (mode === 'firstPerson') setViewMode('perspective');
    sceneRef.current?.setToolMode(mode);

    // Reset explode when leaving explode mode
    if (mode !== 'explode' && explodeScale !== 0) {
      sceneRef.current?.setExplodeScale(0);
      setExplodeScale(0);
    }
    // Clear measure when leaving measure mode
    if (mode !== 'measure') {
      sceneRef.current?.clearMeasure();
    }
    // Cancel pending markup when leaving markup mode
    if (mode !== 'markup') {
      setPendingMarkupPos(null);
    }
  }, [explodeScale]);

  // ── Explode ────────────────────────────────────────────────────
  const handleExplodeChange = useCallback((v: number) => {
    setExplodeScale(v);
    sceneRef.current?.setExplodeScale(v);
  }, []);

  // ── Clip plane ─────────────────────────────────────────────────
  const handleClip = useCallback((elevation: number | null) => {
    setClipElevation(elevation);
    sceneRef.current?.setClipPlane(elevation);
  }, []);

  // Called when section mode drags in the 3D viewport
  const handleSectionChange = useCallback((elevation: number) => {
    setClipElevation(elevation);
  }, []);

  // ── Measure callbacks ──────────────────────────────────────────
  const handleMeasureUpdate = useCallback((info: MeasureInfo) => {
    setMeasureInfo(info);
  }, []);

  // ── Markup callbacks ───────────────────────────────────────────
  const handleMarkupRequest = useCallback((pos: THREE.Vector3, _screen: { x: number; y: number }) => {
    setPendingMarkupPos(pos);
  }, []);

  const handleMarkupConfirm = useCallback((text: string) => {
    if (!pendingMarkupPos) return;
    const scene = sceneRef.current;
    if (!scene) return;
    const item = scene.addMarkup(text, pendingMarkupPos);
    setMarkups(prev => [...prev, item]);
    setPendingMarkupPos(null);
  }, [pendingMarkupPos]);

  const handleMarkupCancel = useCallback(() => setPendingMarkupPos(null), []);

  const handleMarkupRemove = useCallback((id: number) => {
    sceneRef.current?.removeMarkup(id);
    setMarkups(prev => prev.filter(m => m.id !== id));
  }, []);

  // ── Open file dialog ───────────────────────────────────────────
  const handleOpenFile = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.ifc';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) loadFile(file);
    };
    input.click();
  };

  // ── Drop zone (pre-load) ───────────────────────────────────────
  if (!hasModel && !loading) {
    return <DropZone onFile={loadFile} loading={loading} progress={progress} error={error} />;
  }

  return (
    <div className="h-screen flex flex-col bg-[#0d1117] overflow-hidden">

      {/* ── Toolbar ── */}
      <Toolbar
        activeTool={activeTool}
        viewMode={viewMode}
        onTool={handleTool}
        onViewMode={handleViewMode}
        onHome={handleHome}
        onFit={handleFit}
        onOpenFile={handleOpenFile}
        hasModel={hasModel}
        explodeScale={explodeScale}
        onExplodeChange={handleExplodeChange}
      />

      {/* ── Main area ── */}
      <div className="flex flex-1 min-h-0">

        {/* Left: Model tree */}
        {showTree && (
          <div className="w-56 shrink-0 bg-[#161b22] border-r border-slate-800 overflow-hidden flex flex-col">
            <ModelTree tree={tree} selectedID={selectedID} onSelect={handleSelect} />
          </div>
        )}

        {/* Center: 3D canvas + overlay */}
        <div className="flex-1 relative min-w-0">

          {/* Loading overlay */}
          {loading && (
            <div className="absolute inset-0 bg-[#0d1117]/85 z-10 flex flex-col items-center justify-center gap-3">
              <div className="w-10 h-10 rounded-full border-4 border-slate-700 border-t-blue-500 animate-spin" />
              <div className="text-center">
                <p className="text-white text-sm font-medium mb-2">Loading model…</p>
                <div className="w-40 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-slate-500 text-xs mt-2">{progress.toFixed(0)}%</p>
              </div>
            </div>
          )}

          <ViewerCanvas
            sceneRef={sceneRef}
            onSceneReady={onSceneReady}
            onSelect={handleSelect}
            onMeasureUpdate={handleMeasureUpdate}
            onMarkupRequest={handleMarkupRequest}
            onSectionChange={handleSectionChange}
          />

          {/* Scene HTML overlay (measure labels, markup pins, hints) */}
          <SceneOverlay
            sceneRef={sceneRef}
            measureInfo={measureInfo}
            markups={markups}
            pendingMarkupPos={pendingMarkupPos}
            onMarkupConfirm={handleMarkupConfirm}
            onMarkupCancel={handleMarkupCancel}
            onMarkupRemove={handleMarkupRemove}
            activeTool={activeTool}
          />

          {/* View mode badge */}
          <div className="absolute top-3 right-3 pointer-events-none z-10">
            <div className="px-2 py-1 bg-[#161b22]/90 border border-slate-800 rounded text-[10px] text-slate-500 font-mono">
              {viewMode.toUpperCase()} · {activeTool.toUpperCase()}
            </div>
          </div>

          {/* Tree toggle */}
          <button
            onClick={() => setShowTree(p => !p)}
            className="absolute top-3 left-3 z-10 px-2 py-1 bg-[#161b22]/90 border border-slate-800 rounded text-[10px] text-slate-400 hover:text-white transition-colors"
          >
            {showTree ? '◀ Tree' : '▶ Tree'}
          </button>

          {/* Timer toggle */}
          <button
            onClick={() => setShowTimer(p => !p)}
            className="absolute bottom-4 right-3 z-10 px-2 py-1 bg-[#161b22]/90 border border-slate-800 rounded text-[10px] text-slate-400 hover:text-white transition-colors"
          >
            ⏱ Timer
          </button>

          {/* Project timer widget */}
          {showTimer && <ProjectTimer />}

          {/* Measure result panel */}
          {measureInfo.distance !== null && (
            <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-10 pointer-events-auto">
              <div className="bg-[#161b22] border border-amber-500/40 rounded-lg px-4 py-2 flex items-center gap-4 shadow-xl">
                <div className="text-center">
                  <div className="text-[10px] text-slate-500 mb-0.5">Distance</div>
                  <div className="text-lg font-mono font-bold text-amber-400">
                    {measureInfo.distance.toFixed(3)} m
                  </div>
                </div>
                <button
                  onClick={() => { sceneRef.current?.clearMeasure(); }}
                  className="text-[10px] text-slate-500 hover:text-white transition-colors border border-slate-700 px-2 py-1 rounded"
                >
                  Clear
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: Properties panel */}
        <div className="w-56 shrink-0 overflow-hidden flex flex-col">
          <PropertiesPanel
            properties={selectedProps}
            onClose={() => { setSelectedProps(null); setSelectedID(-1); }}
          />
        </div>
      </div>

      {/* ── Storey panel ── */}
      <StoreyPanel
        storeys={storeys}
        clipElevation={clipElevation}
        onClipChange={handleClip}
      />
    </div>
  );
}
