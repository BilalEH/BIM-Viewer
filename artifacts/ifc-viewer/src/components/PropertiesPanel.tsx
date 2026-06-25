import { X, Hash, Tag, FileText, Fingerprint } from 'lucide-react';
import type { IFCElementProps } from '@/lib/ifc-manager';

interface PropertiesPanelProps {
  properties: IFCElementProps | null;
  onClose: () => void;
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 py-2 border-b border-slate-800 last:border-0">
      <span className="text-xs text-slate-500">{label}</span>
      <span className={`text-xs text-slate-200 break-all ${mono ? 'font-mono' : ''}`}>{value || '—'}</span>
    </div>
  );
}

export function PropertiesPanel({ properties, onClose }: PropertiesPanelProps) {
  return (
    <div className="flex flex-col h-full bg-[#161b22] border-l border-slate-800">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800 shrink-0">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Properties</span>
        <button
          data-testid="button-close-properties"
          onClick={onClose}
          className="w-5 h-5 rounded flex items-center justify-center text-slate-600 hover:text-slate-300 hover:bg-slate-800 transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      {properties ? (
        <div className="flex-1 overflow-y-auto px-3">
          {/* Type badge */}
          <div className="py-2 border-b border-slate-800">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-600/20 border border-blue-600/30 rounded text-xs text-blue-400 font-mono">
              <Tag className="w-3 h-3" />
              {properties.type}
            </span>
          </div>

          <Row label="Name" value={properties.name} />

          <div className="flex flex-col gap-0.5 py-2 border-b border-slate-800">
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <Fingerprint className="w-3 h-3" />
              GlobalId
            </span>
            <span className="text-xs text-slate-300 break-all font-mono">{properties.guid || '—'}</span>
          </div>

          <div className="flex flex-col gap-0.5 py-2 border-b border-slate-800">
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <Hash className="w-3 h-3" />
              ExpressID
            </span>
            <span className="text-xs text-slate-300 font-mono">{properties.expressID}</span>
          </div>

          {properties.description && (
            <div className="flex flex-col gap-0.5 py-2 border-b border-slate-800">
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <FileText className="w-3 h-3" />
                Description
              </span>
              <span className="text-xs text-slate-300">{properties.description}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-6 gap-2">
          <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center">
            <Tag className="w-4 h-4 text-slate-600" />
          </div>
          <p className="text-xs text-slate-600 text-center">
            Click an element in the 3D view or model tree to inspect its properties
          </p>
        </div>
      )}
    </div>
  );
}
