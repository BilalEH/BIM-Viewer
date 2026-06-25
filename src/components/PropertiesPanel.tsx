import { useEffect, useState } from 'react';
import { ifcManager, ElementData } from '@/lib/ifc-manager';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Info, Box, Hash } from 'lucide-react';

interface PropertiesPanelProps {
  selectedID: number | null;
}

export function PropertiesPanel({ selectedID }: PropertiesPanelProps) {
  const [data, setData] = useState<ElementData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (selectedID === null) {
      setData(null);
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    async function loadProps() {
      const props = await ifcManager.getElementProperties(selectedID!);
      if (isMounted) {
        setData(props);
        setIsLoading(false);
      }
    }

    loadProps();
    return () => { isMounted = false; };
  }, [selectedID]);

  if (selectedID === null) {
    return (
      <div className="w-80 border-l border-border bg-card flex flex-col h-full shrink-0">
        <div className="p-3 border-b border-border bg-sidebar shrink-0">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">Properties</h3>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-3">
          <Info className="w-8 h-8 text-muted-foreground/30" />
          <p className="text-xs text-muted-foreground">Select an element in the 3D view or tree to inspect its properties.</p>
        </div>
      </div>
    );
  }

  const renderValue = (val: any) => {
    if (val === null || val === undefined) return '-';
    if (typeof val === 'object' && val.value !== undefined) return String(val.value);
    return String(val);
  };

  return (
    <div className="w-80 border-l border-border bg-card flex flex-col h-full shrink-0">
      <div className="p-3 border-b border-border bg-sidebar shrink-0 flex justify-between items-center">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">Properties</h3>
        {selectedID !== null && (
          <span className="text-[10px] font-mono text-muted-foreground bg-background px-1.5 py-0.5 rounded border border-border">
            #{selectedID}
          </span>
        )}
      </div>
      
      <ScrollArea className="flex-1 w-full bg-card">
        {isLoading ? (
          <div className="p-4 space-y-4">
            <div className="space-y-2">
              <div className="h-3 w-1/2 bg-sidebar rounded animate-pulse"></div>
              <div className="h-4 w-3/4 bg-sidebar rounded animate-pulse"></div>
            </div>
            <div className="space-y-2">
              <div className="h-3 w-1/3 bg-sidebar rounded animate-pulse"></div>
              <div className="h-4 w-full bg-sidebar rounded animate-pulse"></div>
              <div className="h-4 w-full bg-sidebar rounded animate-pulse"></div>
              <div className="h-4 w-2/3 bg-sidebar rounded animate-pulse"></div>
            </div>
          </div>
        ) : data ? (
          <div className="pb-6">
            {/* Header / Identity */}
            <div className="p-4 border-b border-border/50 bg-background/50 space-y-3">
              <div className="flex items-start space-x-2">
                <Box className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <h4 className="text-sm font-semibold text-foreground break-all leading-tight">
                    {data.name || 'Unnamed Element'}
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1 font-mono">
                    {data.type.replace('IFC', '')}
                  </p>
                </div>
              </div>
              
              {data.globalId && (
                <div className="flex items-center space-x-2 text-[11px] bg-sidebar p-2 rounded-sm border border-border/50">
                  <Hash className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="font-mono text-muted-foreground select-all break-all">{data.globalId}</span>
                </div>
              )}
            </div>

            {/* General Properties */}
            {data.properties && Object.keys(data.properties).length > 0 && (
              <div className="p-4 border-b border-border/50">
                <h5 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">General Attributes</h5>
                <dl className="grid grid-cols-2 gap-x-2 gap-y-3">
                  {Object.entries(data.properties)
                    .filter(([k, v]) => k !== 'expressID' && typeof v === 'object' && v !== null && 'value' in (v as any))
                    .map(([key, value]) => (
                      <div key={key} className="flex flex-col col-span-2">
                        <dt className="text-[10px] text-muted-foreground">{key}</dt>
                        <dd className="text-xs text-foreground font-medium mt-0.5 break-words bg-sidebar/50 px-1.5 py-1 rounded-sm border border-border/30">
                          {renderValue(value)}
                        </dd>
                      </div>
                  ))}
                </dl>
              </div>
            )}

            {/* Property Sets */}
            {data.psets && data.psets.length > 0 && (
              <div className="p-4 space-y-6">
                {data.psets.map((pset, i) => {
                  const psetName = pset.Name?.value || `Property Set ${i+1}`;
                  const props = pset.HasProperties || [];
                  
                  if (!props || props.length === 0) return null;
                  
                  return (
                    <div key={pset.expressID || i} className="rounded border border-border/50 bg-sidebar/20 overflow-hidden">
                      <h5 className="text-[10px] font-bold uppercase tracking-wider text-primary bg-sidebar/60 px-3 py-2 border-b border-border/50">
                        {psetName}
                      </h5>
                      <dl className="divide-y divide-border/30">
                        {props.map((p: any, j: number) => {
                          const pName = p.Name?.value || `Prop${j}`;
                          const pVal = renderValue(p.NominalValue);
                          return (
                            <div key={p.expressID || j} className="flex flex-col p-2.5 hover:bg-sidebar/40 transition-colors">
                              <dt className="text-[10px] text-muted-foreground">{pName}</dt>
                              <dd className="text-xs text-foreground font-mono mt-0.5 break-words">
                                {pVal}
                              </dd>
                            </div>
                          );
                        })}
                      </dl>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 text-xs text-muted-foreground text-center">
            Failed to load properties.
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
