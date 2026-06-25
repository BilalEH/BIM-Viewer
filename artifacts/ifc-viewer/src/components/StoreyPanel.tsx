import { useState } from 'react';
import { Layers, ChevronUp, ChevronDown } from 'lucide-react';
import type { IFCStorey } from '@/lib/ifc-manager';
import { cn } from '@/lib/utils';

interface StoreyPanelProps {
  storeys: IFCStorey[];
  clipElevation: number | null;
  onClipChange: (elevation: number | null) => void;
}

export function StoreyPanel({ storeys, clipElevation, onClipChange }: StoreyPanelProps) {
  const [collapsed, setCollapsed] = useState(false);

  if (storeys.length === 0) return null;

  const minElev = storeys[0]?.elevation ?? 0;
  const maxElev = (storeys[storeys.length - 1]?.elevation ?? 0) + 5;

  const handleSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    onClipChange(parseFloat(e.target.value));
  };

  return (
    <div className="bg-[#161b22] border-t border-slate-800 shrink-0">
      {/* Header */}
      <button
        data-testid="button-storey-panel-toggle"
        onClick={() => setCollapsed(p => !p)}
        className="w-full flex items-center gap-2 px-4 py-2 text-slate-400 hover:text-white transition-colors"
      >
        <Layers className="w-3.5 h-3.5" />
        <span className="text-xs font-medium">Storeys</span>
        <span className="text-xs text-slate-600 ml-1">({storeys.length})</span>
        <span className="ml-auto">
          {collapsed ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </span>
      </button>

      {!collapsed && (
        <div className="px-4 pb-4">
          {/* Storey list */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {storeys.map(s => (
              <div
                key={s.expressID}
                data-testid={`storey-item-${s.expressID}`}
                className="px-2.5 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-slate-300 font-mono"
              >
                <span className="text-slate-400 mr-1">{s.elevation.toFixed(2)}m</span>
                {s.name}
              </div>
            ))}
          </div>

          {/* Clip slider */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 whitespace-nowrap">Section cut</span>
            <input
              type="range"
              data-testid="slider-storey-clip"
              min={minElev - 1}
              max={maxElev + 5}
              step={0.1}
              value={clipElevation ?? maxElev + 5}
              onChange={handleSlider}
              className="flex-1 accent-blue-500 h-1.5"
            />
            <span className="text-xs font-mono text-slate-400 w-16 text-right">
              {clipElevation !== null ? `${clipElevation.toFixed(1)}m` : 'Off'}
            </span>
            <button
              data-testid="button-clip-reset"
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
        </div>
      )}
    </div>
  );
}
