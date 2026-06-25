/**
 * SceneOverlay — HTML layer that sits on top of the WebGL canvas.
 * Renders:
 *  - Measure labels (distance between two picked points)
 *  - Markup annotation pins (placed by the Markup tool)
 *  - Section-mode hint
 *  - First-person mode WASD hint
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import type * as THREE from 'three';
import type { ThreeScene, MeasureInfo, MarkupItem } from '@/lib/three-scene';
import { X } from 'lucide-react';

interface Props {
  sceneRef: React.MutableRefObject<ThreeScene | null>;
  measureInfo: MeasureInfo;
  markups: MarkupItem[];
  pendingMarkupPos: THREE.Vector3 | null;
  onMarkupConfirm: (text: string) => void;
  onMarkupCancel: () => void;
  onMarkupRemove: (id: number) => void;
  activeTool: string;
}

interface ScreenPin { id: number; x: number; y: number; text: string }

export function SceneOverlay({
  sceneRef,
  measureInfo,
  markups,
  pendingMarkupPos,
  onMarkupConfirm,
  onMarkupCancel,
  onMarkupRemove,
  activeTool,
}: Props) {
  const rafRef = useRef<number>(0);
  const [pins, setPins] = useState<ScreenPin[]>([]);
  const [midpoint, setMidpoint] = useState<{ x: number; y: number } | null>(null);
  const [pendingScreen, setPendingScreen] = useState<{ x: number; y: number } | null>(null);
  const [markupText, setMarkupText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // RAF loop: project 3D positions → 2D screen coords each frame
  useEffect(() => {
    const update = () => {
      const scene = sceneRef.current;
      if (scene) {
        // Markup pins
        const next: ScreenPin[] = markups
          .map(m => {
            const s = scene.projectToScreen(m.position);
            if (!s) return null;
            return { id: m.id, x: s.x, y: s.y, text: m.text };
          })
          .filter(Boolean) as ScreenPin[];
        setPins(next);

        // Measure midpoint label
        if (measureInfo.pointA && measureInfo.pointB && measureInfo.distance !== null) {
          const mid = measureInfo.pointA.clone().lerp(measureInfo.pointB, 0.5);
          const s = scene.projectToScreen(mid);
          setMidpoint(s);
        } else {
          setMidpoint(null);
        }

        // Pending markup position
        if (pendingMarkupPos) {
          const s = scene.projectToScreen(pendingMarkupPos);
          setPendingScreen(s);
        } else {
          setPendingScreen(null);
        }
      }
      rafRef.current = requestAnimationFrame(update);
    };
    rafRef.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafRef.current);
  }, [sceneRef, markups, measureInfo, pendingMarkupPos]);

  // Auto-focus the markup text input when it appears
  useEffect(() => {
    if (pendingMarkupPos) {
      setMarkupText('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [pendingMarkupPos]);

  const confirmMarkup = useCallback(() => {
    const t = markupText.trim();
    if (t) onMarkupConfirm(t);
    else onMarkupCancel();
    setMarkupText('');
  }, [markupText, onMarkupConfirm, onMarkupCancel]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">

      {/* ── Measure distance label ── */}
      {midpoint && measureInfo.distance !== null && (
        <div
          className="absolute pointer-events-none"
          style={{ left: midpoint.x, top: midpoint.y, transform: 'translate(-50%, -50%)' }}
        >
          <div className="bg-amber-400 text-amber-950 text-[11px] font-bold font-mono px-2 py-0.5 rounded-full shadow-lg whitespace-nowrap">
            {measureInfo.distance.toFixed(3)} m
          </div>
        </div>
      )}

      {/* Measure point A label */}
      {measureInfo.pointA && !measureInfo.pointB && (() => {
        const s = sceneRef.current?.projectToScreen(measureInfo.pointA);
        if (!s) return null;
        return (
          <div
            className="absolute pointer-events-none"
            style={{ left: s.x, top: s.y, transform: 'translate(6px, -50%)' }}
          >
            <div className="bg-slate-900/90 border border-amber-400/50 text-amber-300 text-[10px] font-mono px-1.5 py-0.5 rounded shadow whitespace-nowrap">
              A — click point B
            </div>
          </div>
        );
      })()}

      {/* ── Markup pins ── */}
      {pins.map(pin => (
        <div
          key={pin.id}
          className="absolute group pointer-events-auto"
          style={{ left: pin.x, top: pin.y, transform: 'translate(-50%, -100%)' }}
        >
          <div className="relative flex flex-col items-center">
            <div className="bg-orange-500 text-white text-[10px] font-medium px-2 py-0.5 rounded shadow-lg max-w-[120px] truncate whitespace-nowrap">
              {pin.text}
            </div>
            <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-orange-500" />
            {/* Remove button */}
            <button
              onClick={() => onMarkupRemove(pin.id)}
              className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full text-white items-center justify-center hidden group-hover:flex"
            >
              <X className="w-2 h-2" />
            </button>
          </div>
        </div>
      ))}

      {/* ── Pending markup input popup ── */}
      {pendingMarkupPos && pendingScreen && (
        <div
          className="absolute pointer-events-auto"
          style={{ left: pendingScreen.x, top: pendingScreen.y, transform: 'translate(-50%, -100%) translateY(-8px)' }}
        >
          <div className="bg-[#161b22] border border-orange-500/60 rounded-lg shadow-xl p-2 flex items-center gap-2">
            <input
              ref={inputRef}
              value={markupText}
              onChange={e => setMarkupText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') confirmMarkup();
                if (e.key === 'Escape') { onMarkupCancel(); setMarkupText(''); }
              }}
              placeholder="Add annotation…"
              className="text-xs text-white bg-slate-800 border border-slate-600 rounded px-2 py-1 outline-none w-36"
            />
            <button
              onClick={confirmMarkup}
              className="text-[10px] px-2 py-1 bg-orange-500 hover:bg-orange-400 text-white rounded font-medium transition-colors"
            >
              Add
            </button>
            <button
              onClick={() => { onMarkupCancel(); setMarkupText(''); }}
              className="text-slate-500 hover:text-white"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          <div className="flex justify-center">
            <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-orange-500/60" />
          </div>
        </div>
      )}

      {/* ── First-person WASD hint ── */}
      {activeTool === 'firstPerson' && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none">
          <div className="bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-center">
            <p className="text-[10px] text-slate-400 mb-1">Click + drag to look around</p>
            <div className="flex items-center justify-center gap-3 text-[10px] font-mono text-slate-300">
              <span><kbd className="bg-slate-700 px-1 rounded">W</kbd><kbd className="bg-slate-700 px-1 rounded ml-0.5">A</kbd><kbd className="bg-slate-700 px-1 rounded ml-0.5">S</kbd><kbd className="bg-slate-700 px-1 rounded ml-0.5">D</kbd> Move</span>
              <span><kbd className="bg-slate-700 px-1 rounded">Q</kbd>/<kbd className="bg-slate-700 px-1 rounded">E</kbd> Up/Down</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Section mode hint ── */}
      {activeTool === 'section' && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-none">
          <div className="bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-1.5 text-[10px] text-slate-400">
            Drag vertically to move section cut · Use storey slider below
          </div>
        </div>
      )}

      {/* ── Measure hint ── */}
      {activeTool === 'measure' && !measureInfo.pointA && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-none">
          <div className="bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-1.5 text-[10px] text-slate-400">
            Click on the model to place measurement point A
          </div>
        </div>
      )}

      {/* ── Markup hint ── */}
      {activeTool === 'markup' && !pendingMarkupPos && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-none">
          <div className="bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-1.5 text-[10px] text-slate-400">
            Click on the model surface to place an annotation
          </div>
        </div>
      )}
    </div>
  );
}
