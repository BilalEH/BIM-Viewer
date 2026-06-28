import { useState } from 'react';
import { ChevronRight, ChevronDown, Box, Building2, MapPin, Layers, Layers2, Crosshair } from 'lucide-react';
import type { IFCSpatialNode } from '@/lib/ifc-manager';
import { cn } from '@/lib/utils';

const TYPE_ICONS: Record<string, React.ElementType> = {
  IfcProject:       Building2,
  IfcSite:          MapPin,
  IfcBuilding:      Building2,
  IfcBuildingStorey: Layers,
  IfcSpace:         Layers2,
};

interface TreeNodeProps {
  node: IFCSpatialNode;
  depth: number;
  selectedID: number;
  onSelect: (id: number) => void;
  onFlyTo: (id: number) => void;
}

function TreeNode({ node, depth, selectedID, onSelect, onFlyTo }: TreeNodeProps) {
  const [open, setOpen] = useState(depth < 2);
  const [hovered, setHovered] = useState(false);
  const hasChildren = node.children.length > 0;
  const isSelected = node.expressID === selectedID;
  const Icon = TYPE_ICONS[node.type] ?? Box;

  return (
    <div>
      <div
        data-testid={`tree-node-${node.expressID}`}
        className={cn(
          'flex items-center gap-1 py-1 px-2 rounded cursor-pointer text-xs transition-colors group',
          isSelected
            ? 'bg-blue-600/20 text-blue-300'
            : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200',
        )}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => {
          onSelect(node.expressID);
          if (hasChildren) setOpen(p => !p);
        }}
      >
        <span className="w-3 shrink-0">
          {hasChildren
            ? open
              ? <ChevronDown className="w-3 h-3" />
              : <ChevronRight className="w-3 h-3" />
            : null}
        </span>
        <Icon className={cn('w-3 h-3 shrink-0', isSelected ? 'text-blue-400' : 'text-slate-600 group-hover:text-slate-400')} />
        <span className="truncate flex-1">{node.name || node.type}</span>
        <span className={cn('text-[9px] font-mono shrink-0', isSelected ? 'text-blue-500' : 'text-slate-700')}>
          #{node.expressID}
        </span>

        {/* Fly-to button — shown on hover or when selected */}
        <button
          onClick={e => {
            e.stopPropagation();
            onFlyTo(node.expressID);
          }}
          title="Fly camera to this element"
          className={cn(
            'ml-1 p-0.5 rounded transition-all shrink-0',
            hovered || isSelected
              ? 'opacity-100 text-slate-400 hover:text-blue-400'
              : 'opacity-0',
          )}
        >
          <Crosshair className="w-3 h-3" />
        </button>
      </div>

      {open && hasChildren && (
        <div>
          {node.children.map(child => (
            <TreeNode
              key={child.expressID}
              node={child}
              depth={depth + 1}
              selectedID={selectedID}
              onSelect={onSelect}
              onFlyTo={onFlyTo}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface ModelTreeProps {
  tree: IFCSpatialNode | null;
  selectedID: number;
  onSelect: (id: number) => void;
  onFlyTo: (id: number) => void;
}

export function ModelTree({ tree, selectedID, onSelect, onFlyTo }: ModelTreeProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-slate-800 shrink-0">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Model Structure
        </span>
        <p className="text-[10px] text-slate-600 mt-0.5">Click to select · 🎯 to fly camera</p>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {tree ? (
          <TreeNode node={tree} depth={0} selectedID={selectedID} onSelect={onSelect} onFlyTo={onFlyTo} />
        ) : (
          <div className="px-3 py-4 text-xs text-slate-600">No model loaded</div>
        )}
      </div>
    </div>
  );
}
