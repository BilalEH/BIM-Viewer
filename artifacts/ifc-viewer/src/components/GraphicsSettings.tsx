import { Monitor, Grid3X3, Sliders, Eye } from 'lucide-react';
import type { GraphicsSettings } from '@/lib/three-scene';
import { cn } from '@/lib/utils';

interface GraphicsSettingsProps {
  settings: GraphicsSettings;
  fps: number;
  onChange: (s: GraphicsSettings) => void;
  onClose: () => void;
}

const QUALITY_LABELS: Record<GraphicsSettings['quality'], { label: string; desc: string; color: string }> = {
  low:    { label: 'Low',    desc: '0.5× pixel ratio — best for large/complex files', color: 'border-slate-600 text-slate-400' },
  medium: { label: 'Medium', desc: '1× pixel ratio — balanced performance',           color: 'border-blue-700 text-blue-400' },
  high:   { label: 'High',   desc: '1.5× pixel ratio — sharper rendering',            color: 'border-indigo-600 text-indigo-400' },
  ultra:  { label: 'Ultra',  desc: '2× pixel ratio — maximum quality',                color: 'border-violet-600 text-violet-400' },
};

export function GraphicsSettingsPanel({ settings, fps, onChange, onClose }: GraphicsSettingsProps) {
  const set = (patch: Partial<GraphicsSettings>) => onChange({ ...settings, ...patch });

  const fpsColor = fps >= 55 ? 'text-green-400' : fps >= 30 ? 'text-yellow-400' : 'text-red-400';

  return (
    <div className="absolute right-3 top-12 z-30 w-72 bg-[#161b22] border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-semibold text-white">Graphics Settings</span>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs font-mono font-bold ${fpsColor}`}>{fps} FPS</span>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-white text-lg leading-none"
          >
            ×
          </button>
        </div>
      </div>

      <div className="p-4 space-y-5">
        {/* Quality presets */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Monitor className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs font-medium text-slate-300">Render Quality</span>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {(Object.keys(QUALITY_LABELS) as GraphicsSettings['quality'][]).map(q => {
              const meta = QUALITY_LABELS[q];
              const active = settings.quality === q;
              return (
                <button
                  key={q}
                  onClick={() => set({ quality: q })}
                  className={cn(
                    'py-1.5 text-xs font-medium rounded border transition-all',
                    active
                      ? `${meta.color} bg-slate-800`
                      : 'border-slate-700 text-slate-500 hover:border-slate-600 hover:text-slate-300',
                  )}
                >
                  {meta.label}
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-slate-600 mt-1.5">
            {QUALITY_LABELS[settings.quality].desc}
          </p>
        </div>

        {/* Visual toggles */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Eye className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs font-medium text-slate-300">Visual Options</span>
          </div>
          <div className="space-y-2">
            {([
              { key: 'wireframe'   as const, label: 'Wireframe mode',  desc: 'Show mesh edges only' },
              { key: 'flatShading' as const, label: 'Flat shading',    desc: 'Remove smooth normals (faster)' },
              { key: 'showGrid'   as const, label: 'Ground grid',      desc: 'Show reference grid' },
            ] as const).map(item => (
              <label key={item.key} className="flex items-start gap-3 cursor-pointer group">
                <div
                  onClick={() => set({ [item.key]: !settings[item.key] })}
                  className={cn(
                    'mt-0.5 w-9 h-5 rounded-full transition-colors shrink-0 relative',
                    settings[item.key] ? 'bg-blue-600' : 'bg-slate-700 group-hover:bg-slate-600',
                  )}
                >
                  <span
                    className={cn(
                      'absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform',
                      settings[item.key] ? 'translate-x-4' : 'translate-x-0.5',
                    )}
                  />
                </div>
                <div>
                  <div className="text-xs text-slate-300">{item.label}</div>
                  <div className="text-[10px] text-slate-600">{item.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Performance tip */}
        <div className="border border-slate-800 rounded-lg px-3 py-2 bg-slate-900/50">
          <div className="flex items-center gap-1.5 mb-1">
            <Grid3X3 className="w-3 h-3 text-slate-500" />
            <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Tips for Large Models</span>
          </div>
          <ul className="text-[10px] text-slate-600 space-y-0.5 list-disc list-inside">
            <li>Use Low quality for 100+ MB files</li>
            <li>Flat shading reduces GPU load by ~20%</li>
            <li>Wireframe is fastest for structure review</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
