import { useEffect, useRef } from 'react';
import type { ThreeScene, MeasureInfo } from '@/lib/three-scene';
import type * as THREE from 'three';

interface ViewerCanvasProps {
  sceneRef: React.MutableRefObject<ThreeScene | null>;
  onSceneReady: (scene: ThreeScene) => void;
  onSelect: (id: number) => void;
  onMeasureUpdate?: (info: MeasureInfo) => void;
  onMarkupRequest?: (pos: THREE.Vector3, screen: { x: number; y: number }) => void;
  onSectionChange?: (elevation: number) => void;
}

export function ViewerCanvas({
  sceneRef,
  onSceneReady,
  onSelect,
  onMeasureUpdate,
  onMarkupRequest,
  onSectionChange,
}: ViewerCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    import('@/lib/three-scene').then(({ ThreeScene }) => {
      const scene = new ThreeScene();
      scene.init(canvas, onSelect, onMeasureUpdate, onMarkupRequest, onSectionChange);
      sceneRef.current = scene;
      onSceneReady(scene);
    });

    return () => {
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <canvas
      ref={canvasRef}
      data-testid="viewer-canvas"
      className="w-full h-full block"
      style={{ display: 'block' }}
    />
  );
}
