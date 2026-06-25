import { useState, useCallback } from 'react';
import { Upload, FileCode } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DropZoneProps {
  onFile: (file: File) => void;
  loading: boolean;
  progress: number;
  error: string | null;
}

export function DropZone({ onFile, loading, progress, error }: DropZoneProps) {
  const [dragging, setDragging] = useState(false);

  const handleFile = useCallback(
    (file: File) => {
      if (!file.name.toLowerCase().endsWith('.ifc')) {
        return;
      }
      onFile(file);
    },
    [onFile],
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  const onDragLeave = () => setDragging(false);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className="min-h-screen bg-[#0d1117] flex flex-col items-center justify-center p-8">
      {/* Header */}
      <div className="mb-12 text-center">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <FileCode className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">IFC Viewer</h1>
        </div>
        <p className="text-slate-400 text-sm max-w-sm">
          Professional BIM model visualization. Load IFC 2x3 and IFC 4 files directly in your browser.
        </p>
      </div>

      {/* Drop area */}
      <div
        data-testid="drop-zone"
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={cn(
          'w-full max-w-lg border-2 border-dashed rounded-xl p-12 flex flex-col items-center gap-5 transition-all duration-200 cursor-pointer select-none',
          dragging
            ? 'border-blue-500 bg-blue-500/10'
            : 'border-slate-700 bg-slate-900 hover:border-slate-500 hover:bg-slate-800',
        )}
        onClick={() => {
          const input = document.getElementById('ifc-file-input') as HTMLInputElement;
          input?.click();
        }}
      >
        <input
          id="ifc-file-input"
          type="file"
          accept=".ifc"
          className="hidden"
          onChange={onInputChange}
          data-testid="file-input"
        />

        {loading ? (
          <>
            <div className="w-14 h-14 rounded-full border-4 border-slate-700 border-t-blue-500 animate-spin" />
            <div className="text-center">
              <p className="text-white font-medium mb-2">Loading model...</p>
              <div className="w-48 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-slate-500 text-xs mt-2">{progress}%</p>
            </div>
          </>
        ) : (
          <>
            <div
              className={cn(
                'w-14 h-14 rounded-xl flex items-center justify-center transition-colors',
                dragging ? 'bg-blue-600' : 'bg-slate-800',
              )}
            >
              <Upload className={cn('w-7 h-7', dragging ? 'text-white' : 'text-slate-400')} />
            </div>
            <div className="text-center">
              <p className="text-white font-semibold mb-1">
                {dragging ? 'Drop IFC file here' : 'Drop IFC file or click to browse'}
              </p>
              <p className="text-slate-500 text-sm">Supports IFC 2x3 and IFC 4 formats</p>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="px-2.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-xs text-slate-400 font-mono">
                .ifc
              </span>
            </div>
          </>
        )}
      </div>

      {error && (
        <div className="mt-4 px-4 py-3 bg-red-900/30 border border-red-700 rounded-lg text-red-400 text-sm max-w-lg w-full">
          {error}
        </div>
      )}

      {/* Features */}
      <div className="mt-12 grid grid-cols-3 gap-6 max-w-lg w-full">
        {[
          { label: '3D Visualization', desc: 'Full orbit, pan & zoom' },
          { label: 'Storey Filter', desc: 'Clip & isolate floors' },
          { label: 'Model Structure', desc: 'Spatial hierarchy tree' },
        ].map(f => (
          <div key={f.label} className="text-center">
            <p className="text-slate-300 text-xs font-medium mb-0.5">{f.label}</p>
            <p className="text-slate-600 text-xs">{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
