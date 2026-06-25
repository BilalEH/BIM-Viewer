import {
  Home, Maximize2, Hand, ZoomIn, RotateCcw,
  User, Ruler, Scissors, Layers, Edit3,
  FolderOpen, Box, LayoutGrid, ArrowUp, ArrowRight,
} from 'lucide-react';
import type { ToolMode, ViewMode } from '@/lib/three-scene';
import { cn } from '@/lib/utils';

interface ToolbarProps {
  activeTool: ToolMode;
  viewMode: ViewMode;
  onTool: (mode: ToolMode) => void;
  onViewMode: (mode: ViewMode) => void;
  onHome: () => void;
  onFit: () => void;
  onOpenFile: () => void;
  hasModel: boolean;
  explodeScale: number;
  onExplodeChange: (v: number) => void;
}

type Action = { id: 'home' | 'fit'; label: string; Icon: React.ElementType };
const ACTIONS: Action[] = [
  { id: 'home', label: 'Home', Icon: Home },
  { id: 'fit',  label: 'Fit',  Icon: Maximize2 },
];

const NAV_TOOLS: { mode: ToolMode; label: string; Icon: React.ElementType }[] = [
  { mode: 'pan',         label: 'Pan',       Icon: Hand     },
  { mode: 'zoom',        label: 'Zoom',      Icon: ZoomIn   },
  { mode: 'orbit',       label: 'Orbit',     Icon: RotateCcw },
  { mode: 'firstPerson', label: '1st Person',Icon: User     },
];

const ANALYSIS_TOOLS: { mode: ToolMode; label: string; Icon: React.ElementType }[] = [
  { mode: 'measure', label: 'Measure', Icon: Ruler    },
  { mode: 'section', label: 'Section', Icon: Scissors },
  { mode: 'explode', label: 'Explode', Icon: Layers   },
  { mode: 'markup',  label: 'Markup',  Icon: Edit3    },
];

const VIEW_MODES: { mode: ViewMode; label: string; Icon: React.ElementType }[] = [
  { mode: 'perspective', label: '3D',    Icon: Box       },
  { mode: 'top',         label: 'Top',   Icon: ArrowUp   },
  { mode: 'front',       label: 'Front', Icon: LayoutGrid },
  { mode: 'side',        label: 'Side',  Icon: ArrowRight },
];

function Divider() {
  return <div className="w-px h-10 bg-slate-700 mx-0.5 shrink-0" />;
}

function ToolBtn({
  label, Icon, active, onClick, title,
}: {
  label: string;
  Icon: React.ElementType;
  active?: boolean;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title ?? label}
      className={cn(
        'relative flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-lg transition-all shrink-0',
        active
          ? 'text-blue-400 bg-blue-500/10'
          : 'text-slate-400 hover:text-white hover:bg-slate-800',
      )}
    >
      {active && (
        <span className="absolute inset-0 rounded-lg border border-blue-500/50 pointer-events-none" />
      )}
      <Icon className="w-[18px] h-[18px]" />
      <span className="text-[10px] font-medium leading-none whitespace-nowrap">{label}</span>
    </button>
  );
}

function ActionBtn({ label, Icon, onClick }: { label: string; Icon: React.ElementType; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={label}
      className="flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-lg transition-all shrink-0 text-slate-400 hover:text-white hover:bg-slate-800"
    >
      <Icon className="w-[18px] h-[18px]" />
      <span className="text-[10px] font-medium leading-none whitespace-nowrap">{label}</span>
    </button>
  );
}

export function Toolbar({
  activeTool, viewMode, onTool, onViewMode,
  onHome, onFit, onOpenFile, hasModel,
  explodeScale, onExplodeChange,
}: ToolbarProps) {
  return (
    <div className="h-16 bg-[#161b22] border-b border-slate-800 flex items-center px-3 gap-0.5 shrink-0 overflow-x-auto">

      {/* Logo */}
      <div className="flex items-center gap-2 mr-2 shrink-0">
        <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
          <Box className="w-4 h-4 text-white" />
        </div>
        <span className="text-white text-sm font-semibold tracking-tight hidden lg:block">IFC Viewer</span>
      </div>

      <Divider />

      {/* Open File */}
      <ActionBtn label="Open" Icon={FolderOpen} onClick={onOpenFile} />

      {hasModel && (
        <>
          <Divider />

          {/* Actions: Home + Fit */}
          {ACTIONS.map(({ id, label, Icon }) => (
            <ActionBtn
              key={id}
              label={label}
              Icon={Icon}
              onClick={id === 'home' ? onHome : onFit}
            />
          ))}

          <Divider />

          {/* Navigation tools */}
          {NAV_TOOLS.map(({ mode, label, Icon }) => (
            <ToolBtn
              key={mode}
              label={label}
              Icon={Icon}
              active={activeTool === mode}
              onClick={() => onTool(mode)}
            />
          ))}

          <Divider />

          {/* Analysis tools */}
          {ANALYSIS_TOOLS.map(({ mode, label, Icon }) => (
            <ToolBtn
              key={mode}
              label={label}
              Icon={Icon}
              active={activeTool === mode}
              onClick={() => onTool(mode)}
            />
          ))}

          {/* Explode slider — shown inline when explode active */}
          {activeTool === 'explode' && (
            <div className="flex items-center gap-2 ml-2 pl-2 border-l border-slate-700 shrink-0">
              <span className="text-[10px] text-slate-400 whitespace-nowrap">Scale</span>
              <input
                type="range" min={0} max={1} step={0.01}
                value={explodeScale}
                onChange={e => onExplodeChange(parseFloat(e.target.value))}
                className="w-24 accent-blue-500 h-1.5 cursor-pointer"
              />
              <span className="text-[10px] font-mono text-slate-400 w-8">{(explodeScale * 100).toFixed(0)}%</span>
            </div>
          )}

          <Divider />

          {/* View modes */}
          <div className="flex items-center gap-0.5 bg-slate-800/60 rounded-lg p-0.5 shrink-0">
            {VIEW_MODES.map(({ mode, label, Icon }) => (
              <button
                key={mode}
                title={label}
                onClick={() => onViewMode(mode)}
                className={cn(
                  'flex items-center gap-1 px-2 py-1.5 rounded text-[10px] font-medium transition-all whitespace-nowrap',
                  viewMode === mode
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700',
                )}
              >
                <Icon className="w-3 h-3" />
                {label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
