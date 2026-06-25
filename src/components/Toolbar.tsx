import { Button } from '@/components/ui/button';
import { ViewMode } from '@/lib/three-scene';
import { Box, Layers, AppWindow, ArrowRightFromLine, ArrowDownFromLine } from 'lucide-react';

interface ToolbarProps {
  currentView: ViewMode;
  onViewChange: (mode: ViewMode) => void;
  onReset: () => void;
}

export function Toolbar({ currentView, onViewChange, onReset }: ToolbarProps) {
  return (
    <div className="flex items-center space-x-2 p-1.5 bg-card border-b border-border shadow-sm shrink-0">
      <div className="flex items-center px-3 space-x-2 border-r border-border mr-2">
        <Box className="w-5 h-5 text-primary" />
        <span className="font-semibold text-sm tracking-tight text-foreground">IFC Viewer</span>
      </div>
      
      <div className="flex bg-sidebar rounded-md p-1 border border-border">
        <Button 
          variant={currentView === 'perspective' ? 'secondary' : 'ghost'} 
          size="sm"
          className="h-7 px-2.5 text-xs font-medium"
          onClick={() => onViewChange('perspective')}
          data-testid="btn-view-perspective"
        >
          <Box className="w-3.5 h-3.5 mr-1.5" />
          3D
        </Button>
        <Button 
          variant={currentView === 'top' ? 'secondary' : 'ghost'} 
          size="sm"
          className="h-7 px-2.5 text-xs font-medium"
          onClick={() => onViewChange('top')}
          data-testid="btn-view-top"
        >
          <ArrowDownFromLine className="w-3.5 h-3.5 mr-1.5" />
          Top
        </Button>
        <Button 
          variant={currentView === 'front' ? 'secondary' : 'ghost'} 
          size="sm"
          className="h-7 px-2.5 text-xs font-medium"
          onClick={() => onViewChange('front')}
          data-testid="btn-view-front"
        >
          <AppWindow className="w-3.5 h-3.5 mr-1.5" />
          Front
        </Button>
        <Button 
          variant={currentView === 'side' ? 'secondary' : 'ghost'} 
          size="sm"
          className="h-7 px-2.5 text-xs font-medium"
          onClick={() => onViewChange('side')}
          data-testid="btn-view-side"
        >
          <ArrowRightFromLine className="w-3.5 h-3.5 mr-1.5" />
          Side
        </Button>
      </div>

      <div className="flex-1" />

      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onReset} data-testid="btn-reset-view">
        Reset Camera
      </Button>
    </div>
  );
}
