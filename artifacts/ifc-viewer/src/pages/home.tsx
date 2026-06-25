import { useState, useRef, useCallback, useEffect } from 'react';
import { DropZone } from '@/components/DropZone';
import { ViewerCanvas } from '@/components/ViewerCanvas';
import { Toolbar } from '@/components/Toolbar';
import { StoreyPanel } from '@/components/StoreyPanel';
import { ModelTree } from '@/components/ModelTree';
import { PropertiesPanel } from '@/components/PropertiesPanel';
import { ifcManager, type IFCSpatialNode, type IFCStorey, type IFCElementProps, type IFCMeshData } from '@/lib/ifc-manager';
import type { ThreeScene, ViewMode } from '@/lib/three-scene';

export default function Home() {
  const sceneRef = useRef<ThreeScene | null>(null);
  // Holds meshes parsed before scene is ready, so we can apply them on init
  const pendingMeshesRef = useRef<IFCMeshData[] | null>(null);

  // State
  const [hasModel, setHasModel] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('perspective');
  const [storeys, setStoreys] = useState<IFCStorey[]>([]);
  const [tree, setTree] = useState<IFCSpatialNode | null>(null);
  const [clipElevation, setClipElevation] = useState<number | null>(null);
  const [selectedID, setSelectedID] = useState(-1);
  const [selectedProps, setSelectedProps] = useState<IFCElementProps | null>(null);
  const [showTree, setShowTree] = useState(true);

  // Scene ready — flush any meshes that were parsed before scene init
  const onSceneReady = useCallback((scene: ThreeScene) => {
    if (pendingMeshesRef.current) {
      scene.addMeshes(pendingMeshesRef.current);
      pendingMeshesRef.current = null;
    }
  }, []);

  // Keep IFC manager initialized
  useEffect(() => {
    ifcManager.init().catch(() => {/* silent pre-init */});
  }, []);

  const loadFile = useCallback(async (file: File) => {
    setLoading(true);
    setProgress(0);
    setError(null);
    setSelectedID(-1);
    setSelectedProps(null);
    setClipElevation(null);
    pendingMeshesRef.current = null;

    try {
      await ifcManager.init();
      setProgress(5);

      const buffer = await file.arrayBuffer();
      const meshes = await ifcManager.loadBuffer(buffer, (p) => setProgress(p));

      const scene = sceneRef.current;
      if (scene) {
        scene.clearMeshes();
        scene.addMeshes(meshes);
      } else {
        // Scene not mounted yet — queue for when it's ready
        pendingMeshesRef.current = meshes;
      }

      const newStoreys = ifcManager.getStoreys();
      const newTree = ifcManager.getSpatialTree();
      setStoreys(newStoreys);
      setTree(newTree);
      setHasModel(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load IFC file. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSelect = useCallback((id: number) => {
    setSelectedID(id);
    const props = ifcManager.getElementProperties(id);
    setSelectedProps(props);
    sceneRef.current?.highlight(id);
  }, []);

  const handleViewMode = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    sceneRef.current?.setViewMode(mode);
  }, []);

  const handleReset = useCallback(() => {
    sceneRef.current?.fitCamera();
    sceneRef.current?.setViewMode('perspective');
    setViewMode('perspective');
  }, []);

  const handleClip = useCallback((elevation: number | null) => {
    setClipElevation(elevation);
    sceneRef.current?.setClipPlane(elevation);
  }, []);

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

  if (!hasModel && !loading) {
    return <DropZone onFile={loadFile} loading={loading} progress={progress} error={error} />;
  }

  return (
    <div className="h-screen flex flex-col bg-[#0d1117] overflow-hidden">
      {/* Toolbar */}
      <Toolbar
        viewMode={viewMode}
        onViewMode={handleViewMode}
        onReset={handleReset}
        onOpenFile={handleOpenFile}
        hasModel={hasModel}
      />

      {/* Main area */}
      <div className="flex flex-1 min-h-0">
        {/* Left: Model tree */}
        {showTree && (
          <div
            data-testid="panel-model-tree"
            className="w-56 shrink-0 bg-[#161b22] border-r border-slate-800 overflow-hidden flex flex-col"
          >
            <ModelTree tree={tree} selectedID={selectedID} onSelect={handleSelect} />
          </div>
        )}

        {/* Center: 3D canvas */}
        <div className="flex-1 relative min-w-0">
          {loading && (
            <div className="absolute inset-0 bg-[#0d1117]/80 z-10 flex flex-col items-center justify-center gap-3">
              <div className="w-10 h-10 rounded-full border-4 border-slate-700 border-t-blue-500 animate-spin" />
              <div className="text-center">
                <p className="text-white text-sm font-medium mb-2">Loading model...</p>
                <div className="w-40 h-1 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          <ViewerCanvas
            sceneRef={sceneRef}
            onSceneReady={onSceneReady}
            onSelect={handleSelect}
          />

          {/* View mode badge */}
          <div className="absolute top-3 right-3 px-2 py-1 bg-[#161b22]/90 border border-slate-800 rounded text-xs text-slate-500 font-mono pointer-events-none">
            {viewMode.toUpperCase()}
          </div>

          {/* Tree toggle */}
          <button
            data-testid="button-toggle-tree"
            onClick={() => setShowTree(p => !p)}
            className="absolute top-3 left-3 px-2 py-1 bg-[#161b22]/90 border border-slate-800 rounded text-xs text-slate-400 hover:text-white transition-colors"
          >
            {showTree ? '◀ Tree' : '▶ Tree'}
          </button>
        </div>

        {/* Right: Properties */}
        <div
          data-testid="panel-properties"
          className="w-56 shrink-0 overflow-hidden flex flex-col"
        >
          <PropertiesPanel
            properties={selectedProps}
            onClose={() => {
              setSelectedProps(null);
              setSelectedID(-1);
            }}
          />
        </div>
      </div>

      {/* Bottom: Storey panel */}
      <StoreyPanel
        storeys={storeys}
        clipElevation={clipElevation}
        onClipChange={handleClip}
      />
    </div>
  );
}
