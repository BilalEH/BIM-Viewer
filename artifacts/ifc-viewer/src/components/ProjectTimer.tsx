import { useState, useEffect, useRef, useCallback } from 'react';
import { Timer, Play, Pause, RotateCcw, ChevronDown, ChevronUp, Target, Pencil, Check } from 'lucide-react';

// ── Types & helpers ───────────────────────────────────────────────

interface Session { start: number; end: number | null }

interface TimerState {
  taskName: string;
  targetMinutes: number;
  sessions: Session[];
}

const STORAGE_KEY = 'ifc-project-timer';

function load(): TimerState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as TimerState;
  } catch { /* ignore */ }
  return { taskName: 'My Project', targetMinutes: 0, sessions: [] };
}

function save(s: TimerState): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

function totalMs(sessions: Session[], now: number): number {
  return sessions.reduce((acc, s) => acc + ((s.end ?? now) - s.start), 0);
}

function fmt(ms: number): string {
  const s  = Math.floor(ms / 1000);
  const h  = Math.floor(s / 3600);
  const m  = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

// ── Component ─────────────────────────────────────────────────────

export function ProjectTimer() {
  const [state, setState]       = useState<TimerState>(load);
  const [tick, setTick]         = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const [editName, setEditName]   = useState(false);
  const [nameVal, setNameVal]     = useState('');
  const [editTarget, setEditTarget] = useState(false);
  const [targetVal, setTargetVal]   = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isRunning = state.sessions.length > 0 && state.sessions.at(-1)!.end === null;

  const persist = useCallback((next: TimerState) => {
    setState(next);
    save(next);
  }, []);

  // Tick every second when running
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => setTick(t => t + 1), 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isRunning]);

  const now = Date.now();
  const elapsed = totalMs(state.sessions, now);
  const targetMs = state.targetMinutes * 60 * 1000;
  const progress = targetMs > 0 ? Math.min(100, (elapsed / targetMs) * 100) : 0;
  const done = targetMs > 0 && elapsed >= targetMs;

  // SVG ring
  const R = 20;
  const C = 2 * Math.PI * R;

  const start = () => {
    if (isRunning) return;
    persist({ ...state, sessions: [...state.sessions, { start: Date.now(), end: null }] });
  };

  const pause = () => {
    if (!isRunning) return;
    const sessions = state.sessions.map((s, i) =>
      i === state.sessions.length - 1 ? { ...s, end: Date.now() } : s,
    );
    persist({ ...state, sessions });
  };

  const reset = () => persist({ ...state, sessions: [] });

  const confirmName = () => {
    persist({ ...state, taskName: nameVal.trim() || state.taskName });
    setEditName(false);
  };

  const confirmTarget = () => {
    persist({ ...state, targetMinutes: Math.max(0, parseInt(targetVal) || 0) });
    setEditTarget(false);
  };

  const fmtTarget = (min: number) =>
    min >= 60 ? `${(min / 60).toFixed(1)}h` : `${min}m`;

  // suppress unused tick warning
  void tick;

  return (
    <div className="absolute bottom-16 right-3 z-20 w-56 bg-[#161b22] border border-slate-700 rounded-xl shadow-2xl overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#1c2333] border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Timer className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-xs font-semibold text-white">Project Timer</span>
          {isRunning && (
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          )}
        </div>
        <button onClick={() => setCollapsed(c => !c)} className="text-slate-500 hover:text-white transition-colors">
          {collapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {!collapsed && (
        <div className="p-3 flex flex-col gap-3">

          {/* Task name */}
          <div className="flex items-center gap-1.5 group">
            {editName ? (
              <>
                <input
                  autoFocus
                  value={nameVal}
                  onChange={e => setNameVal(e.target.value)}
                  onBlur={confirmName}
                  onKeyDown={e => { if (e.key === 'Enter') confirmName(); }}
                  className="flex-1 text-xs text-white bg-slate-800 border border-slate-600 rounded px-2 py-1 outline-none"
                />
                <button onClick={confirmName} className="text-green-400 hover:text-green-300"><Check className="w-3 h-3" /></button>
              </>
            ) : (
              <>
                <span className="flex-1 text-xs text-slate-300 truncate">{state.taskName}</span>
                <button
                  onClick={() => { setNameVal(state.taskName); setEditName(true); }}
                  className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-slate-300 transition-opacity"
                >
                  <Pencil className="w-3 h-3" />
                </button>
              </>
            )}
          </div>

          {/* Ring + time display */}
          <div className="flex items-center gap-3">
            {/* Progress ring */}
            <div className="relative w-14 h-14 shrink-0">
              <svg viewBox="0 0 48 48" className="w-full h-full -rotate-90">
                <circle cx="24" cy="24" r={R} fill="none" stroke="#1e293b" strokeWidth="4" />
                {targetMs > 0 && (
                  <circle
                    cx="24" cy="24" r={R}
                    fill="none"
                    stroke={done ? '#22c55e' : '#3b82f6'}
                    strokeWidth="4"
                    strokeDasharray={C}
                    strokeDashoffset={C * (1 - progress / 100)}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 1s linear' }}
                  />
                )}
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                {targetMs > 0 ? (
                  <span className={`text-[10px] font-bold ${done ? 'text-green-400' : 'text-blue-400'}`}>
                    {progress.toFixed(0)}%
                  </span>
                ) : (
                  <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-green-400 animate-pulse' : 'bg-slate-600'}`} />
                )}
              </div>
            </div>

            {/* Time text */}
            <div className="flex-1 min-w-0">
              <div className="text-xl font-mono font-bold text-white tracking-widest tabular-nums">
                {fmt(elapsed)}
              </div>
              {done && (
                <div className="text-[10px] text-green-400 font-medium mt-0.5">🎉 Goal reached!</div>
              )}
              {targetMs > 0 && !done && (
                <div className="text-[10px] text-slate-500 mt-0.5">
                  of {fmtTarget(state.targetMinutes)}
                </div>
              )}
              <div className="text-[10px] text-slate-600 mt-0.5">
                {state.sessions.length} session{state.sessions.length !== 1 ? 's' : ''}
              </div>
            </div>
          </div>

          {/* Progress bar (always visible when target set) */}
          {targetMs > 0 && (
            <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${done ? 'bg-green-500' : 'bg-blue-500'}`}
                style={{ width: `${progress}%` }}
              />
            </div>
          )}

          {/* Controls */}
          <div className="flex gap-1.5">
            {isRunning ? (
              <button
                onClick={pause}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 hover:bg-amber-500/25 text-xs font-medium transition-colors"
              >
                <Pause className="w-3 h-3" /> Pause
              </button>
            ) : (
              <button
                onClick={start}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-green-500/15 border border-green-500/30 text-green-400 hover:bg-green-500/25 text-xs font-medium transition-colors"
              >
                <Play className="w-3 h-3" /> Start
              </button>
            )}
            <button
              onClick={reset}
              title="Reset timer"
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>

          {/* Target duration */}
          <div className="flex items-center gap-2">
            <Target className="w-3 h-3 text-slate-600 shrink-0" />
            {editTarget ? (
              <div className="flex flex-1 gap-1">
                <input
                  autoFocus
                  type="number"
                  min="0"
                  value={targetVal}
                  onChange={e => setTargetVal(e.target.value)}
                  onBlur={confirmTarget}
                  onKeyDown={e => { if (e.key === 'Enter') confirmTarget(); }}
                  className="flex-1 text-xs text-white bg-slate-800 border border-slate-600 rounded px-2 py-0.5 outline-none"
                  placeholder="Minutes (e.g. 120)"
                />
                <button onClick={confirmTarget} className="text-green-400 hover:text-green-300"><Check className="w-3 h-3" /></button>
              </div>
            ) : (
              <button
                onClick={() => { setTargetVal(String(state.targetMinutes)); setEditTarget(true); }}
                className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors text-left"
              >
                {state.targetMinutes > 0 ? `Target: ${fmtTarget(state.targetMinutes)}` : 'Set target duration…'}
              </button>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
