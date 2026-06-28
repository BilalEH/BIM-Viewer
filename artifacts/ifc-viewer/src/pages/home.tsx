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
import { FpsCounter } from '@/components/FpsCounter';
import { GraphicsSettingsPanel } from '@/components/GraphicsSettings';
import {
  ifcManager,
  type IFCSpatialNode,
  type IFCStorey,
  type IFCElementProps,
  type IFCMeshData,
} from '@/lib/ifc-manager';
import type {
  ThreeScene,
  ViewMode,
  ToolMode,
  MeasureInfo,
  MarkupItem,
  GraphicsSettings,
} from '@/lib/three-scene';

export default function Home() {
  const sceneRef = useRef<ThreeScene | null>(null);
  const pendingMeshesRef    = useRef<IFCMeshData[]>([]);
  const loadCompleteRef     = useRef(false);  // tracks whether loadBuffer() resolved while scene wasn't ready yet

  // ── Core state ─────────────────────────────────────────────────
  const [hasModel, setHasModel]   = useState(false);
  const [loading, setLoading]     = useState(false);
  const [progress, setProgress]   = useState(0);
  const [error, setError]         = useState<string | null>(null);

  // ── Camera / view state ────────────────────────────────────────
  const [viewMode, setViewMode]   = useState<ViewMode>('perspective');
  const [activeTool, setActiveTool] = useState<ToolMode>('orbit');

  // ── Model data ─────────────────────────────────────────────────
  const [storeys, setStoreys]     = useState<IFCStorey[]>([]);
  const [tree, setTree]           = useState<IFCSpatialNode | null>(null);
  const [clipElevation, setClipElevation] = useState<number | null>(null);

  // ── Selection ──────────────────────────────────────────────────
  const [selectedID, setSelectedID]       = useState(-1);
  const [selectedProps, setSelectedProps] = useState<IFCElementProps | null>(null);

  // ── Panels ─────────────────────────────────────────────────────
  const [showTree, setShowTree]         = useState(true);
  const [showTimer, setShowTimer]       = useState(false);
  const [showFps, setShowFps]           = useState(false);
  const [showGfxSettings, setShowGfxSettings] = useState(false);

  // ── FPS ────────────────────────────────────────────────────────
  const [fps, setFps] = useState(0);

  // ── Graphics settings ──────────────────────────────────────────
  const [gfxSettings, setGfxSettings] = useState<GraphicsSettings>({
    quality: 'high',
    wireframe: false,
    flatShading: false,
    showGrid: true,
  });

  // ── Explode ────────────────────────────────────────────────────
  const [explodeScale, setExplodeScale] = useState(0);

  // ── Measure ────────────────────────────────────────────────────
  const [measureInfo, setMeasureInfo] = useState<MeasureInfo>({
    pointA: null, pointB: null, distance: null,
  });

  // ── Markup ─────────────────────────────────────────────────────
  const [markups, setMarkups]                   = useState<MarkupItem[]>([]);
  const [pendingMarkupPos, setPendingMarkupPos] = useState<THREE.Vector3 | null>(null);

  // ── 2D plan ────────────────────────────────────────────────────
  const [is2DPlan, setIs2DPlan] = useState(false);

  // ── Construction simulation ────────────────────────────────────
  const [isSimulating, setIsSimulating]     = useState(false);
  const [simStep, setSimStep]               = useState(0);
  const [simTotal, setSimTotal]             = useState(0);
  const [simStoreyName, setSimStoreyName]   = useState('');

  // ── Scene ready — flush pending meshes ─────────────────────────
  const onSceneReady = useCallback((scene: ThreeScene) => {
    const pending = pendingMeshesRef.current;
    if (pending.length) {
      pending.forEach(m => scene.queueMesh(m));
      pendingMeshesRef.current = [];
    }
    // If loadBuffer() already resolved while the canvas was still mounting,
    // signal finalizeLoad() now so fitCamera() and explode-data get computed.
    if (loadCompleteRef.current) {
      scene.finalizeLoad();
      loadCompleteRef.current = false;
    }
  }, []);

  // ── Pre-init IFC WASM ──────────────────────────────────────────
  useEffect(() => {
    ifcManager.init().catch(() => {/* silent — retried on load */});
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
    setIs2DPlan(false);
    setIsSimulating(false);
    setSimStep(0);
    pendingMeshesRef.current = [];

    // Clear scene immediately so the user sees a clean state
    sceneRef.current?.clearMeshes();

    try {
      await ifcManager.init();
      setProgress(5);

      const buffer = await file.arrayBuffer();
      setProgress(10);

      // Stream meshes from the Web Worker — UI stays responsive
      await ifcManager.loadBuffer(
        buffer,
        (mesh: IFCMeshData) => {
          const scene = sceneRef.current;
          if (scene) {
            scene.queueMesh(mesh);
          } else {
            pendingMeshesRef.current.push(mesh);
          }
        },
        (p) => setProgress(Math.max(progress, p)),
      );

      // Signal Three.js that all meshes have been queued.
      // If the scene is already ready, call directly; otherwise set the ref
      // so onSceneReady() will call it when the canvas mounts.
      if (sceneRef.current) {
        sceneRef.current.finalizeLoad();
      } else {
        loadCompleteRef.current = true;
      }

      // Fetch model metadata from main-thread IFC API (fast, sync)
      const newStoreys = ifcManager.getStoreys();
      const newTree    = ifcManager.getSpatialTree();

      setStoreys(newStoreys);
      setTree(newTree);
      setHasModel(true);

      // Build storey→element map for 2D plan and simulation
      if (sceneRef.current && newStoreys.length) {
        const storeyMap = ifcManager.buildStoreyElementMap(newStoreys);
        sceneRef.current.buildStoreyElementMap(storeyMap);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load IFC file.');
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Selection ──────────────────────────────────────────────────
  const handleSelect = useCallback((id: number) => {
    setSelectedID(id);
    setSelectedProps(ifcManager.getElementProperties(id));
    sceneRef.current?.highlight(id);
  }, []);

  const handleFlyTo = useCallback((id: number) => {
    sceneRef.current?.flyToElement(id);
    // Also select the element
    setSelectedID(id);
    setSelectedProps(ifcManager.getElementProperties(id));
  }, []);

  // ── View mode ──────────────────────────────────────────────────
  const handleViewMode = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    sceneRef.current?.setViewMode(mode);
  }, []);

  const handleHome = useCallback(() => {
    if (is2DPlan) { sceneRef.current?.exit2DPlan(); setIs2DPlan(false); }
    sceneRef.current?.fitCamera();
    sceneRef.current?.setViewMode('perspective');
    setViewMode('perspective');
  }, [is2DPlan]);

  const handleFit = useCallback(() => {
    sceneRef.current?.fitCamera();
  }, []);

  // ── Tool mode ──────────────────────────────────────────────────
  const handleTool = useCallback((mode: ToolMode) => {
    setActiveTool(mode);
    if (mode === 'firstPerson') setViewMode('perspective');
    sceneRef.current?.setToolMode(mode);
    if (mode !== 'explode' && explodeScale !== 0) {
      sceneRef.current?.setExplodeScale(0);
      setExplodeScale(0);
    }
    if (mode !== 'measure') sceneRef.current?.clearMeasure();
    if (mode !== 'markup') setPendingMarkupPos(null);
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

  const handleSectionChange = useCallback((elevation: number) => {
    setClipElevation(elevation);
  }, []);

  // ── Measure ────────────────────────────────────────────────────
  const handleMeasureUpdate = useCallback((info: MeasureInfo) => {
    setMeasureInfo(info);
  }, []);

  // ── Markup ─────────────────────────────────────────────────────
  const handleMarkupRequest = useCallback((pos: THREE.Vector3) => {
    setPendingMarkupPos(pos);
  }, []);

  const handleMarkupConfirm = useCallback((text: string) => {
    if (!pendingMarkupPos || !sceneRef.current) return;
    const item = sceneRef.current.addMarkup(text, pendingMarkupPos);
    setMarkups(prev => [...prev, item]);
    setPendingMarkupPos(null);
  }, [pendingMarkupPos]);

  const handleMarkupCancel  = useCallback(() => setPendingMarkupPos(null), []);
  const handleMarkupRemove  = useCallback((id: number) => {
    sceneRef.current?.removeMarkup(id);
    setMarkups(prev => prev.filter(m => m.id !== id));
  }, []);

  // ── Graphics settings ──────────────────────────────────────────
  const handleGfxChange = useCallback((s: GraphicsSettings) => {
    setGfxSettings(s);
    sceneRef.current?.applyGraphicsSettings(s);
  }, []);

  // ── 2D Floor Plan ──────────────────────────────────────────────
  const handle2DPlan = useCallback((storeyExpressID: number) => {
    sceneRef.current?.show2DPlan(storeyExpressID, storeys);
    setIs2DPlan(true);
    setViewMode('top');
  }, [storeys]);

  const handleExit2DPlan = useCallback(() => {
    sceneRef.current?.exit2DPlan();
    setIs2DPlan(false);
    setViewMode('perspective');
  }, []);

  // ── Construction simulation ────────────────────────────────────
  const handleStartSimulation = useCallback(() => {
    if (!storeys.length) return;
    setIsSimulating(true);
    setSimStep(0);
    setSimTotal(storeys.length);
    setSimStoreyName('');

    sceneRef.current?.startSimulation(
      storeys,
      (step, total, name) => {
        setSimStep(step);
        setSimTotal(total);
        setSimStoreyName(name);
      },
      () => {
        setIsSimulating(false);
        setSimStep(storeys.length);
      },
      1800,
    );
  }, [storeys]);

  const handleStopSimulation = useCallback(() => {
    sceneRef.current?.stopSimulation();
    setIsSimulating(false);
    setSimStep(0);
  }, []);

  // ── Open file dialog ───────────────────────────────────────────
  const handleOpenFile = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.ifc';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) loadFile(file);
    };
    input.click();
  }, [loadFile]);

  // ── FPS callback ───────────────────────────────────────────────
  const handleFpsUpdate = useCallback((f: number) => setFps(f), []);

  // ── Pre-load screen ────────────────────────────────────────────
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
          <div className="w-60 shrink-0 bg-[#161b22] border-r border-slate-800 overflow-hidden flex flex-col">
            <ModelTree
              tree={tree}
              selectedID={selectedID}
              onSelect={handleSelect}
              onFlyTo={handleFlyTo}
            />
          </div>
        )}

        {/* Center: 3D canvas + overlays */}
        <div className="flex-1 relative min-w-0">

          {/* Loading overlay */}
          {loading && (
            <div className="absolute inset-0 bg-[#0d1117]/85 z-10 flex flex-col items-center justify-center gap-3">
              <div className="w-10 h-10 rounded-full border-4 border-slate-700 border-t-blue-500 animate-spin" />
              <div className="text-center">
                <p className="text-white text-sm font-medium mb-2">Loading model…</p>
                <div className="w-48 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-150"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-slate-400 text-xs mt-1.5">{progress.toFixed(0)}%</p>
                {progress >= 15 && progress < 100 && (
                  <p className="text-slate-600 text-[10px] mt-1">
                    Parsing geometry in background…
                  </p>
                )}
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
            onFpsUpdate={handleFpsUpdate}
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

          {/* ── Top-right HUD ── */}
          <div className="absolute top-3 right-3 z-20 flex flex-col items-end gap-2">
            {/* View mode badge + settings button */}
            <div className="flex items-center gap-2">
              <div className="px-2 py-1 bg-[#161b22]/90 border border-slate-800 rounded text-[10px] text-slate-500 font-mono pointer-events-none">
                {viewMode.toUpperCase()} · {activeTool.toUpperCase()}
              </div>
              {/* FPS toggle */}
              <button
                onClick={() => setShowFps(p => !p)}
                title="Toggle FPS counter"
                className={`px-2 py-1 text-[10px] rounded border transition-colors ${
                  showFps
                    ? 'border-green-700 text-green-400 bg-green-950/30'
                    : 'border-slate-700 text-slate-500 bg-[#161b22]/90 hover:text-white'
                }`}
              >
                FPS
              </button>
              {/* Graphics settings toggle */}
              <button
                onClick={() => setShowGfxSettings(p => !p)}
                title="Graphics settings"
                className={`px-2 py-1 text-[10px] rounded border transition-colors ${
                  showGfxSettings
                    ? 'border-blue-700 text-blue-400 bg-blue-950/30'
                    : 'border-slate-700 text-slate-500 bg-[#161b22]/90 hover:text-white'
                }`}
              >
                ⚙ GFX
              </button>
            </div>

            {/* FPS counter */}
            {showFps && <FpsCounter fps={fps} visible={showFps} />}
          </div>

          {/* Graphics settings panel */}
          {showGfxSettings && (
            <GraphicsSettingsPanel
              settings={gfxSettings}
              fps={fps}
              onChange={handleGfxChange}
              onClose={() => setShowGfxSettings(false)}
            />
          )}

          {/* ── Top-left controls ── */}
          <div className="absolute top-3 left-3 z-10 flex gap-2">
            <button
              onClick={() => setShowTree(p => !p)}
              className="px-2 py-1 bg-[#161b22]/90 border border-slate-800 rounded text-[10px] text-slate-400 hover:text-white transition-colors"
            >
              {showTree ? '◀ Tree' : '▶ Tree'}
            </button>
            {is2DPlan && (
              <button
                onClick={handleExit2DPlan}
                className="px-2 py-1 bg-blue-900/40 border border-blue-800 rounded text-[10px] text-blue-400 hover:text-blue-200 transition-colors"
              >
                📐 Exit 2D Plan
              </button>
            )}
          </div>

          {/* ── Bottom-right controls ── */}
          <button
            onClick={() => setShowTimer(p => !p)}
            className="absolute bottom-4 right-3 z-10 px-2 py-1 bg-[#161b22]/90 border border-slate-800 rounded text-[10px] text-slate-400 hover:text-white transition-colors"
          >
            ⏱ Timer
          </button>
          {showTimer && <ProjectTimer />}

          {/* Measure result */}
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
                  onClick={() => sceneRef.current?.clearMeasure()}
                  className="text-[10px] text-slate-500 hover:text-white border border-slate-700 px-2 py-1 rounded"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {/* Selected element highlight pulse indicator */}
          {selectedID >= 0 && !loading && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
              <div className="px-3 py-1 bg-blue-900/40 border border-blue-800/50 rounded-full text-[10px] text-blue-400 font-mono">
                Selected: #{selectedID}
                {selectedProps?.name && selectedProps.name !== 'Unnamed' && ` — ${selectedProps.name}`}
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

      {/* ── Storey / simulation panel ── */}
      <StoreyPanel
        storeys={storeys}
        clipElevation={clipElevation}
        onClipChange={handleClip}
        is2DPlan={is2DPlan}
        on2DPlan={handle2DPlan}
        onExit2DPlan={handleExit2DPlan}
        isSimulating={isSimulating}
        simStep={simStep}
        simTotal={simTotal}
        simStoreyName={simStoreyName}
        onStartSimulation={handleStartSimulation}
        onStopSimulation={handleStopSimulation}
      />
    </div>
  );
}
