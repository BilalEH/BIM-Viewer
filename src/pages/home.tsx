import { useState, useCallback, useRef } from 'react';
import { DropZone } from '@/components/DropZone';
import { ViewerCanvas } from '@/components/ViewerCanvas';
import { Toolbar } from '@/components/Toolbar';
import { ModelTree } from '@/components/ModelTree';
import { StoreyPanel } from '@/components/StoreyPanel';
import { PropertiesPanel } from '@/components/PropertiesPanel';
import { ViewMode, ThreeScene } from '@/lib/three-scene';

export default function HomePage() {
  const [isFileLoaded, setIsFileLoaded] = useState(false);
  const [selectedID, setSelectedID] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('perspective');
  const [selectedElevation, setSelectedElevation] = useState<number | null>(null);
  
  const sceneRef = useRef<ThreeScene | null>(null);

  const handleFileLoaded = useCallback(() => {
    setIsFileLoaded(true);
  }, []);

  const handleSceneReady = useCallback((scene: ThreeScene) => {
    sceneRef.current = scene;
  }, []);

  const handleSelect = useCallback((id: number | null) => {
    setSelectedID(id);
    if (sceneRef.current) {
      sceneRef.current.selectElement(id);
    }
  }, []);

  const handleResetCamera = useCallback(() => {
    if (sceneRef.current) {
      sceneRef.current.setViewMode(viewMode);
    }
  }, [viewMode]);

  return (
    <div className="flex flex-col w-full h-screen bg-background overflow-hidden text-foreground">
      {!isFileLoaded ? (
        <DropZone onFileLoaded={handleFileLoaded} />
      ) : (
        <div className="flex flex-col w-full h-full">
          {/* Header / Toolbar */}
          <Toolbar 
            currentView={viewMode} 
            onViewChange={setViewMode} 
            onReset={handleResetCamera} 
          />

          {/* Main Content Area */}
          <div className="flex flex-1 overflow-hidden relative">
            {/* Left Panel: Model Tree */}
            <ModelTree 
              selectedID={selectedID} 
              onSelect={handleSelect} 
            />

            {/* Center: 3D Viewer */}
            <div className="flex-1 relative border-r border-border flex flex-col">
              <div className="flex-1 relative">
                <ViewerCanvas 
                  onSelect={handleSelect}
                  viewMode={viewMode}
                  selectedStoreyElevation={selectedElevation}
                  onSceneReady={handleSceneReady}
                />
              </div>
              
              {/* Bottom: Storey Slider overlay or panel */}
              <StoreyPanel onElevationChange={setSelectedElevation} />
            </div>

            {/* Right Panel: Properties */}
            <PropertiesPanel selectedID={selectedID} />
          </div>
        </div>
      )}
    </div>
  );
}
