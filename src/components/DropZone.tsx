import { useState, useCallback, useRef, useEffect } from 'react';
import { UploadCloud } from 'lucide-react';
import { ifcManager } from '@/lib/ifc-manager';

interface DropZoneProps {
  onFileLoaded: () => void;
}

export function DropZone({ onFileLoaded }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const loadFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.ifc')) {
      alert("Please upload an .ifc file");
      return;
    }

    setIsLoading(true);
    setLoadingMsg("Parsing IFC...");

    try {
      const buffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(buffer);
      await ifcManager.loadModel(uint8Array);
      onFileLoaded();
    } catch (err) {
      console.error(err);
      alert("Error loading IFC file. See console for details.");
      setIsLoading(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      loadFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      loadFile(e.target.files[0]);
    }
  };

  return (
    <div className="flex h-full w-full items-center justify-center p-6 bg-background">
      <div 
        className={`w-full max-w-2xl border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
          isDragging ? 'border-primary bg-card/50' : 'border-border bg-card'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        data-testid="drop-zone"
      >
        <div className="flex flex-col items-center justify-center space-y-6">
          <div className="rounded-full bg-sidebar p-6 shadow-sm border border-border">
            <UploadCloud className="h-10 w-10 text-primary" />
          </div>
          
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              {isLoading ? 'Processing Model' : 'Load IFC Model'}
            </h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              {isLoading 
                ? loadingMsg 
                : 'Drag and drop your Industry Foundation Classes (.ifc) file here, or click to browse.'}
            </p>
          </div>

          {!isLoading && (
            <div className="relative">
              <input
                type="file"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                accept=".ifc"
                onChange={handleFileInput}
                data-testid="input-file"
              />
              <button className="px-6 py-2.5 bg-primary text-primary-foreground font-medium rounded-md shadow-sm hover:bg-primary/90 transition-colors">
                Select File
              </button>
            </div>
          )}

          {isLoading && (
            <div className="w-full max-w-xs space-y-2">
              <div className="h-1.5 w-full bg-sidebar rounded-full overflow-hidden">
                <div className="h-full bg-primary w-full animate-pulse rounded-full origin-left" style={{ animationDuration: '2s', animationIterationCount: 'infinite' }}></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
