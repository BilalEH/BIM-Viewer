import { useEffect, useState } from 'react';
import { ifcManager } from '@/lib/ifc-manager';
import { ChevronRight, ChevronDown, Component, Building, Box, FolderTree } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SpatialNode {
  expressID: number;
  type: string;
  children: SpatialNode[];
}

interface ModelTreeProps {
  selectedID: number | null;
  onSelect: (id: number) => void;
}

const formatType = (type: string) => {
  if (type.startsWith('IFC')) {
    return type.substring(3);
  }
  return type;
};

const getIconForType = (type: string) => {
  const t = type.toUpperCase();
  if (t === 'IFCPROJECT') return <FolderTree className="w-3.5 h-3.5 text-blue-400" />;
  if (t === 'IFCSITE') return <Building className="w-3.5 h-3.5 text-green-400" />;
  if (t === 'IFCBUILDING') return <Building className="w-3.5 h-3.5 text-amber-400" />;
  if (t === 'IFCBUILDINGSTOREY') return <Box className="w-3.5 h-3.5 text-purple-400" />;
  return <Component className="w-3 h-3 text-muted-foreground" />;
};

function TreeNode({ 
  node, 
  depth, 
  selectedID, 
  onSelect 
}: { 
  node: SpatialNode, 
  depth: number,
  selectedID: number | null,
  onSelect: (id: number) => void
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const isSelected = selectedID === node.expressID;
  const hasChildren = node.children && node.children.length > 0;
  
  // Try to get name (async, but we'll do it sync for simplicity if it's cached, or just use ID for now)
  // In a real app we'd fetch names in bulk
  
  return (
    <div className="flex flex-col w-full text-sm">
      <div 
        className={`flex items-center py-1 px-2 cursor-pointer select-none border-b border-border/50 group ${
          isSelected ? 'bg-primary/20 text-foreground' : 'text-muted-foreground hover:bg-sidebar hover:text-foreground'
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(node.expressID);
        }}
        data-testid={`tree-node-${node.expressID}`}
      >
        <div 
          className="w-4 h-4 flex items-center justify-center mr-1 opacity-70 group-hover:opacity-100"
          onClick={(e) => {
            if (hasChildren) {
              e.stopPropagation();
              setExpanded(!expanded);
            }
          }}
        >
          {hasChildren ? (
            expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />
          ) : <span className="w-3.5 h-3.5" />}
        </div>
        
        <div className="mr-2">
          {getIconForType(node.type)}
        </div>
        
        <span className="truncate font-medium text-xs flex-1">
          {formatType(node.type)}
        </span>
        
        <span className="text-[10px] font-mono opacity-50 ml-2">
          #{node.expressID}
        </span>
      </div>
      
      {expanded && hasChildren && (
        <div className="flex flex-col">
          {node.children.map((child) => (
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

export function ModelTree({ selectedID, onSelect }: ModelTreeProps) {
  const [treeData, setTreeData] = useState<SpatialNode | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadStructure() {
      try {
        const structure = await ifcManager.getSpatialStructure();
        setTreeData(structure as SpatialNode);
      } catch (e) {
        console.error("Failed to load spatial structure", e);
      } finally {
        setIsLoading(false);
      }
    }
    loadStructure();
  }, []);

  return (
    <div className="w-64 border-r border-border bg-card flex flex-col h-full shrink-0">
      <div className="p-3 border-b border-border bg-sidebar shrink-0">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">Spatial Structure</h3>
      </div>
      
      <ScrollArea className="flex-1 w-full bg-card">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-4 bg-sidebar rounded animate-pulse w-full" style={{ opacity: 1 - i * 0.1 }}></div>
            ))}
          </div>
        ) : treeData ? (
          <div className="py-2 pb-6 w-full">
            <TreeNode 
              node={treeData} 
              depth={0} 
              selectedID={selectedID} 
              onSelect={onSelect} 
            />
          </div>
        ) : (
          <div className="p-4 text-xs text-muted-foreground text-center">
            No spatial structure found.
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
