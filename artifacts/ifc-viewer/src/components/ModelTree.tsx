import { useState } from 'react';
import { ChevronRight, ChevronDown, Box, Building2, MapPin, Layers, Layers2 } from 'lucide-react';
import type { IFCSpatialNode } from '@/lib/ifc-manager';
import { cn } from '@/lib/utils';

const TYPE_ICONS: Record<string, React.ElementType> = {
  IfcProject: Building2,
  IfcSite: MapPin,
  IfcBuilding: Building2,
  IfcBuildingStorey: Layers,
  IfcSpace: Layers2,
};

interface TreeNodeProps {
  node: IFCSpatialNode;
  depth: number;
  selectedID: number;
  onSelect: (id: number) => void;
}

function TreeNode({ node, depth, selectedID, onSelect }: TreeNodeProps) {
  const [open, setOpen] = useState(depth < 2);
  const hasChildren = node.children.length > 0;
  const isSelected = node.expressID === selectedID;
  const Icon = TYPE_ICONS[node.type] ?? Box;

  return (
    <div>
      <div
        data-testid={`tree-node-${node.expressID}`}
        className={cn(
          'flex items-center gap-1.5 py-1 px-2 rounded cursor-pointer text-xs transition-colors group',
          isSelected ? 'bg-blue-600/20 text-blue-300' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200',
        )}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
        onClick={() => {
          onSelect(node.expressID);
          if (hasChildren) setOpen(p => !p);
        }}
      >
        <span className="w-3 shrink-0">
          {hasChildren ? (
            open ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )
          ) : null}
        </span>
        <Icon className={cn('w-3 h-3 shrink-0', isSelected ? 'text-blue-400' : 'text-slate-600 group-hover:text-slate-400')} />
        <span className="truncate flex-1">{node.name || node.type}</span>
        <span className={cn('text-xs font-mono shrink-0', isSelected ? 'text-blue-500' : 'text-slate-700')}>
          #{node.expressID}
        </span>
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
}

export function ModelTree({ tree, selectedID, onSelect }: ModelTreeProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-slate-800 shrink-0">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Model Structure</span>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {tree ? (
          <TreeNode node={tree} depth={0} selectedID={selectedID} onSelect={onSelect} />
        ) : (
          <div className="px-3 py-4 text-xs text-slate-600">No model loaded</div>
        )}
      </div>
    </div>
  );
}
