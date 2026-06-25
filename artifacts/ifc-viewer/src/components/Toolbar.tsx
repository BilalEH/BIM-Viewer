import { FileCode, Box, LayoutGrid, ArrowRight, ArrowUp, RotateCcw, FolderOpen } from 'lucide-react';
import type { ViewMode } from '@/lib/three-scene';
import { cn } from '@/lib/utils';

interface ToolbarProps {
  viewMode: ViewMode;
  onViewMode: (mode: ViewMode) => void;
  onReset: () => void;
  onOpenFile: () => void;
  hasModel: boolean;
}

const VIEWS: { mode: ViewMode; label: string; Icon: React.ElementType }[] = [
  { mode: 'perspective', label: '3D', Icon: Box },
  { mode: 'top', label: 'Top', Icon: ArrowUp },
  { mode: 'front', label: 'Front', Icon: LayoutGrid },
  { mode: 'side', label: 'Side', Icon: ArrowRight },
];

export function Toolbar({ viewMode, onViewMode, onReset, onOpenFile, hasModel }: ToolbarProps) {
  return (
    <div className="h-11 bg-[#161b22] border-b border-slate-800 flex items-center px-3 gap-3 shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2 mr-2">
        <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center">
          <FileCode className="w-3.5 h-3.5 text-white" />
        </div>
        <span className="text-white text-sm font-semibold tracking-tight hidden sm:block">IFC Viewer</span>
      </div>

      <div className="w-px h-5 bg-slate-700" />

      {/* Open file */}
      <button
        data-testid="button-open-file"
        onClick={onOpenFile}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
      >
        <FolderOpen className="w-3.5 h-3.5" />
        <span>Open File</span>
      </button>

      {hasModel && (
        <>
          <div className="w-px h-5 bg-slate-700" />

          {/* View mode buttons */}
          <div className="flex items-center gap-0.5 bg-slate-800 rounded-md p-0.5">
            {VIEWS.map(({ mode, label, Icon }) => (
              <button
                key={mode}
                data-testid={`button-view-${mode}`}
                onClick={() => onViewMode(mode)}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-all',
                  viewMode === mode
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700',
                )}
              >
                <Icon className="w-3 h-3" />
                <span>{label}</span>
              </button>
            ))}
          </div>

          <div className="w-px h-5 bg-slate-700" />

          {/* Reset */}
          <button
            data-testid="button-reset-camera"
            onClick={onReset}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        </>
      )}
    </div>
  );
}
