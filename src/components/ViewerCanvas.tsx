import { useEffect, useRef, useState } from 'react';
import { ThreeScene, ViewMode } from '@/lib/three-scene';

interface ViewerCanvasProps {
  onSelect: (expressID: number | null) => void;
  viewMode: ViewMode;
  selectedStoreyElevation: number | null;
  onSceneReady: (scene: ThreeScene) => void;
}

export function ViewerCanvas({ 
  onSelect, 
  viewMode, 
  selectedStoreyElevation,
  onSceneReady 
}: ViewerCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<ThreeScene | null>(null);
  const [isLoadingGeometry, setIsLoadingGeometry] = useState(true);

  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new ThreeScene(containerRef.current);
    sceneRef.current = scene;
    scene.setOnSelect(onSelect);
    
    // Load geometry
    setIsLoadingGeometry(true);
    scene.loadModelGeometries().then(() => {
      setIsLoadingGeometry(false);
      onSceneReady(scene);
    });

    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, []); // Run once on mount

  useEffect(() => {
    if (sceneRef.current && !isLoadingGeometry) {
      sceneRef.current.setViewMode(viewMode);
    }
  }, [viewMode, isLoadingGeometry]);

  useEffect(() => {
    if (sceneRef.current && !isLoadingGeometry) {
      sceneRef.current.setStoreyClipping(selectedStoreyElevation);
    }
  }, [selectedStoreyElevation, isLoadingGeometry]);

  return (
    <div className="relative w-full h-full bg-background overflow-hidden" data-testid="viewer-container">
      <div 
        ref={containerRef} 
        className="absolute inset-0" 
        data-testid="three-canvas-container"
      />
      
      {isLoadingGeometry && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-10">
          <div className="flex flex-col items-center space-y-4">
            <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
            <div className="text-sm font-medium text-foreground tracking-tight">Extracting Geometry...</div>
          </div>
        </div>
      )}
    </div>
  );
}
