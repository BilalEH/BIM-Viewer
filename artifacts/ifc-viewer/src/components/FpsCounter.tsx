import { useEffect, useRef, useState } from 'react';

interface FpsCounterProps {
  fps: number;
  visible: boolean;
}

const MAX_SAMPLES = 60;

export function FpsCounter({ fps, visible }: FpsCounterProps) {
  const [history, setHistory] = useState<number[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Build rolling history
  useEffect(() => {
    if (!visible) return;
    setHistory(prev => {
      const next = [...prev, fps];
      return next.length > MAX_SAMPLES ? next.slice(next.length - MAX_SAMPLES) : next;
    });
  }, [fps, visible]);

  // Draw sparkline
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !visible || history.length < 2) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const max = Math.max(60, ...history);
    const min = 0;

    ctx.beginPath();
    ctx.strokeStyle = fps >= 55 ? '#22c55e' : fps >= 30 ? '#eab308' : '#ef4444';
    ctx.lineWidth = 1.5;
    history.forEach((v, i) => {
      const x = (i / (MAX_SAMPLES - 1)) * w;
      const y = h - ((v - min) / (max - min)) * h;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Fill under graph
    ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
    ctx.fillStyle = fps >= 55 ? 'rgba(34,197,94,0.12)' : fps >= 30 ? 'rgba(234,179,8,0.12)' : 'rgba(239,68,68,0.12)';
    ctx.fill();
  }, [history, fps, visible]);

  if (!visible) return null;

  const color = fps >= 55 ? 'text-green-400' : fps >= 30 ? 'text-yellow-400' : 'text-red-400';
  const label = fps >= 55 ? 'Smooth' : fps >= 30 ? 'OK' : 'Low';

  return (
    <div className="bg-[#0d1117]/90 border border-slate-800 rounded-lg px-3 py-2 pointer-events-none select-none min-w-[120px]">
      <div className="flex items-baseline gap-2 mb-1">
        <span className={`text-xl font-mono font-bold leading-none ${color}`}>{fps}</span>
        <span className="text-[10px] text-slate-500">FPS</span>
        <span className={`text-[10px] ml-auto font-medium ${color}`}>{label}</span>
      </div>
      <canvas
        ref={canvasRef}
        width={100}
        height={24}
        className="w-full block"
        style={{ imageRendering: 'pixelated' }}
      />
      <div className="flex justify-between mt-0.5">
        <span className="text-[9px] text-slate-600">60s</span>
        <span className="text-[9px] text-slate-600">now</span>
      </div>
    </div>
  );
}
