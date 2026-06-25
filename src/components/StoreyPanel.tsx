import { useEffect, useState } from 'react';
import { ifcManager, StoreyData } from '@/lib/ifc-manager';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Layers } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface StoreyPanelProps {
  onElevationChange: (elevation: number | null) => void;
}

export function StoreyPanel({ onElevationChange }: StoreyPanelProps) {
  const [storeys, setStoreys] = useState<StoreyData[]>([]);
  const [activeElevation, setActiveElevation] = useState<number | null>(null);
  const [sliderVal, setSliderVal] = useState<number[]>([100]); // 100% means show all

  useEffect(() => {
    // Fetch storeys
    const fetched = ifcManager.getStoreys();
    setStoreys(fetched);
  }, []);

  if (storeys.length === 0) {
    return (
      <div className="h-10 border-t border-border bg-card flex items-center px-4 text-xs text-muted-foreground shrink-0">
        No storeys detected in this model.
      </div>
    );
  }

  const minElev = storeys[0].elevation;
  const maxElev = storeys[storeys.length - 1].elevation;
  // Add a bit of headroom to the max elevation
  const topElev = maxElev + 5; 
  
  const handleSliderChange = (vals: number[]) => {
    setSliderVal(vals);
    const percent = vals[0];
    
    if (percent === 100) {
      setActiveElevation(null);
      onElevationChange(null);
    } else {
      // Map percent to elevation
      const currentElev = minElev + (percent / 100) * (topElev - minElev);
      setActiveElevation(currentElev);
      onElevationChange(currentElev);
    }
  };

  const setStoreyElev = (elev: number | null) => {
    if (elev === null) {
      handleSliderChange([100]);
    } else {
      const percent = Math.max(0, Math.min(100, ((elev - minElev) / (topElev - minElev)) * 100));
      handleSliderChange([percent]);
    }
  };

  return (
    <div className="h-14 border-t border-border bg-card flex items-center px-4 space-x-6 shrink-0 z-20">
      <div className="flex items-center space-x-2 shrink-0">
        <Layers className="w-4 h-4 text-primary" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Storey Clip</span>
      </div>
      
      <div className="flex-1 max-w-xl flex items-center space-x-4">
        <span className="text-[10px] text-muted-foreground font-mono w-12 text-right">
          {minElev.toFixed(1)}m
        </span>
        <Slider 
          value={sliderVal} 
          onValueChange={handleSliderChange} 
          max={100} 
          step={0.1}
          className="flex-1"
          data-testid="slider-storey-clip"
        />
        <span className="text-[10px] text-muted-foreground font-mono w-12">
          All
        </span>
      </div>

      <div className="flex-1 overflow-hidden h-full flex items-center justify-end">
        <div className="flex space-x-2 px-2 overflow-x-auto no-scrollbar pb-1">
          <button 
            className={`text-xs px-2 py-1 rounded border transition-colors shrink-0 ${
              activeElevation === null 
                ? 'bg-primary/20 border-primary/50 text-primary-foreground' 
                : 'bg-sidebar border-border text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setStoreyElev(null)}
            data-testid="btn-storey-all"
          >
            Show All
          </button>
          {storeys.reverse().map((storey) => {
            // "Active" means this storey is the active slice limit
            const isCutHere = activeElevation !== null && Math.abs(activeElevation - storey.elevation) < 0.1;
            return (
              <button
                key={storey.expressID}
                className={`text-xs px-2 py-1 rounded border transition-colors shrink-0 max-w-[120px] truncate ${
                  isCutHere
                    ? 'bg-primary/20 border-primary/50 text-primary-foreground'
                    : 'bg-sidebar border-border text-muted-foreground hover:text-foreground'
                }`}
                title={storey.name}
                onClick={() => setStoreyElev(storey.elevation)}
                data-testid={`btn-storey-${storey.expressID}`}
              >
                {storey.name}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
