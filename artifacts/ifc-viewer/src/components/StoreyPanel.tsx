import { useState } from 'react';
import { Layers, ChevronUp, ChevronDown, Map, Play, Square } from 'lucide-react';
import type { IFCStorey } from '@/lib/ifc-manager';
import { cn } from '@/lib/utils';

interface StoreyPanelProps {
  storeys: IFCStorey[];
  clipElevation: number | null;
  onClipChange: (elevation: number | null) => void;
  // 2D plan
  is2DPlan: boolean;
  on2DPlan: (storeyExpressID: number) => void;
  onExit2DPlan: () => void;
  // Construction simulation
  isSimulating: boolean;
  simStep: number;
  simTotal: number;
  simStoreyName: string;
  onStartSimulation: () => void;
  onStopSimulation: () => void;
}

export function StoreyPanel({
  storeys,
  clipElevation,
  onClipChange,
  is2DPlan,
  on2DPlan,
  onExit2DPlan,
  isSimulating,
  simStep,
  simTotal,
  simStoreyName,
  onStartSimulation,
  onStopSimulation,
}: StoreyPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [hoveredStorey, setHoveredStorey] = useState<number | null>(null);

  if (storeys.length === 0) return null;

  const minElev = storeys[0]?.elevation ?? 0;
  const maxElev = (storeys[storeys.length - 1]?.elevation ?? 0) + 5;

  return (
    <div className="bg-[#161b22] border-t border-slate-800 shrink-0">
      {/* Header */}
      <div className="flex items-center border-b border-slate-800/60">
        <button
          onClick={() => setCollapsed(p => !p)}
          className="flex-1 flex items-center gap-2 px-4 py-2 text-slate-400 hover:text-white transition-colors"
        >
          <Layers className="w-3.5 h-3.5" />
          <span className="text-xs font-medium">Storeys</span>
          <span className="text-xs text-slate-600 ml-1">({storeys.length})</span>
          <span className="ml-auto">
            {collapsed ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </span>
        </button>

        {/* Simulate button */}
        {!collapsed && storeys.length > 0 && (
          isSimulating ? (
            <button
              onClick={onStopSimulation}
              className="flex items-center gap-1.5 px-3 py-1.5 mr-2 text-xs font-medium text-red-400 border border-red-800/60 rounded hover:bg-red-900/20 transition-colors"
            >
              <Square className="w-3 h-3" />
              Stop
            </button>
          ) : (
            <button
              onClick={onStartSimulation}
              title="Construction Simulation — reveal storeys level by level"
              className="flex items-center gap-1.5 px-3 py-1.5 mr-2 text-xs font-medium text-emerald-400 border border-emerald-800/60 rounded hover:bg-emerald-900/20 transition-colors"
            >
              <Play className="w-3 h-3" />
              Simulate
            </button>
          )
        )}
      </div>

      {/* Simulation progress bar */}
      {isSimulating && (
        <div className="px-4 py-2 bg-emerald-950/40 border-b border-emerald-900/30">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-emerald-400 font-medium">
              🏗 Construction Simulation
            </span>
            <span className="text-xs font-mono text-emerald-500">
              {simStep} / {simTotal}
            </span>
          </div>
          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-700"
              style={{ width: `${simTotal > 0 ? (simStep / simTotal) * 100 : 0}%` }}
            />
          </div>
          {simStoreyName && (
            <p className="text-[10px] text-emerald-600 mt-1">
              Adding: {simStoreyName}
            </p>
          )}
        </div>
      )}

      {/* 2D plan banner */}
      {is2DPlan && (
        <div className="px-4 py-2 bg-blue-950/40 border-b border-blue-900/30 flex items-center justify-between">
          <span className="text-xs text-blue-400 font-medium">📐 2D Floor Plan Mode</span>
          <button
            onClick={onExit2DPlan}
            className="text-xs text-blue-500 hover:text-blue-300 underline"
          >
            Exit → 3D
          </button>
        </div>
      )}

      {!collapsed && (
        <div className="px-4 pb-4 pt-3">
          {/* Storey list */}
          <div className="flex flex-col gap-1 mb-4">
            {storeys.map(s => (
              <div
                key={s.expressID}
                onMouseEnter={() => setHoveredStorey(s.expressID)}
                onMouseLeave={() => setHoveredStorey(null)}
                className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-800/60 border border-slate-700/50 rounded group hover:border-slate-600 transition-colors"
              >
                <span className="text-[10px] font-mono text-slate-500 w-14 shrink-0">
                  {s.elevation.toFixed(2)}m
                </span>
                <span className="text-xs text-slate-300 flex-1 truncate">{s.name}</span>

                {/* 2D Plan button — visible on hover */}
                <button
                  onClick={() => is2DPlan ? onExit2DPlan() : on2DPlan(s.expressID)}
                  title="View 2D floor plan of this level"
                  className={cn(
                    'flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-all border',
                    hoveredStorey === s.expressID || is2DPlan
                      ? 'opacity-100'
                      : 'opacity-0 group-hover:opacity-100',
                    is2DPlan
                      ? 'border-blue-700 text-blue-400 bg-blue-950/40'
                      : 'border-slate-600 text-slate-400 hover:text-blue-400 hover:border-blue-700',
                  )}
                >
                  <Map className="w-3 h-3" />
                  2D
                </button>
              </div>
            ))}
          </div>

          {/* Clip slider */}
          {!is2DPlan && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500 whitespace-nowrap">Section cut</span>
              <input
                type="range"
                min={minElev - 1}
                max={maxElev + 5}
                step={0.1}
                value={clipElevation ?? maxElev + 5}
                onChange={e => onClipChange(parseFloat(e.target.value))}
                className="flex-1 accent-blue-500 h-1.5"
              />
              <span className="text-xs font-mono text-slate-400 w-16 text-right">
                {clipElevation !== null ? `${clipElevation.toFixed(1)}m` : 'Off'}
              </span>
              <button
                onClick={() => onClipChange(null)}
                className={cn(
                  'text-xs px-2 py-0.5 rounded border transition-colors',
                  clipElevation !== null
                    ? 'border-blue-600 text-blue-400 hover:bg-blue-900/20'
                    : 'border-slate-700 text-slate-600 cursor-default',
                )}
              >
                Clear
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
