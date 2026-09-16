import React from 'react';
import { MiningSessionState, AccuracyTier, isWedgeUnlocked } from '../types';
import { Hammer, RotateCcw, AlertTriangle, ShieldCheck, Zap, Layers, Plus } from 'lucide-react';

interface MiningHUDProps {
  session: MiningSessionState;
  onSelectWedge: (index: number) => void;
  onAddWedge: () => void;
  onResetActiveWedge: () => void;
  onCrowbarPry: (side: 'left' | 'right') => void;
}

export const MiningHUD: React.FC<MiningHUDProps> = ({
  session,
  onSelectWedge,
  onAddWedge,
  onResetActiveWedge,
  onCrowbarPry,
}) => {
  const activeWedge = session.wedges[session.activeWedgeIndex];

  // Helper for accuracy tier badge color
  const getBadgeStyle = (tier: AccuracyTier) => {
    switch (tier) {
      case 'perfect':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50';
      case 'great':
        return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50';
      case 'good':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/50';
      case 'okay':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/50';
      case 'bad':
        return 'bg-orange-500/20 text-orange-300 border-orange-500/50';
      case 'horrible':
      case 'miss':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/50';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="w-full bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-2xl p-4 shadow-xl space-y-4">
      {/* Crowbar Pry Active Controls Banner */}
      {session.phase === 'crowbar-prying' && (
        <div className="bg-gradient-to-r from-cyan-950 via-slate-900 to-cyan-950 p-3 rounded-xl border border-cyan-500/50 shadow-lg space-y-2 animate-pulse">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-cyan-400 animate-bounce" />
              <span className="text-sm font-black text-cyan-300 tracking-wider uppercase">
                FRACTURE LEVERAGE AT 100%! CROWBAR PRY UNLOCKED!
              </span>
            </div>
            <span className="text-xs font-bold text-emerald-400 bg-emerald-500/20 px-2.5 py-1 rounded-full border border-emerald-500/40">
              Pry Progress: {Math.round(session.crowbarProgress)}%
            </span>
          </div>

          <p className="text-xs text-slate-300">
            Pry the rock slab loose! Watch the yellow indicator marker at the bottom of the screen. When it enters the target side, press the matching button or key:
          </p>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              onClick={() => onCrowbarPry('left')}
              className={`py-2.5 px-4 rounded-xl border font-black text-xs uppercase tracking-wider transition flex items-center justify-center gap-2 cursor-pointer shadow-md ${
                session.crowbarTargetSide === 'left'
                  ? 'bg-emerald-500/30 text-emerald-300 border-emerald-400 ring-2 ring-emerald-500/50 scale-[1.02]'
                  : 'bg-slate-900 text-slate-400 border-slate-700 hover:bg-slate-800'
              }`}
            >
              <span>← PRY LEFT</span>
              <span className="text-[10px] text-slate-400 font-normal">(Press A / Left Arrow)</span>
            </button>

            <button
              onClick={() => onCrowbarPry('right')}
              className={`py-2.5 px-4 rounded-xl border font-black text-xs uppercase tracking-wider transition flex items-center justify-center gap-2 cursor-pointer shadow-md ${
                session.crowbarTargetSide === 'right'
                  ? 'bg-emerald-500/30 text-emerald-300 border-emerald-400 ring-2 ring-emerald-500/50 scale-[1.02]'
                  : 'bg-slate-900 text-slate-400 border-slate-700 hover:bg-slate-800'
              }`}
            >
              <span>PRY RIGHT →</span>
              <span className="text-[10px] text-slate-400 font-normal">(Press D / Right Arrow)</span>
            </button>
          </div>
        </div>
      )}

      {/* Max Depth Reached Banner for Active Wedge */}
      {session.phase === 'hammering' && activeWedge && activeWedge.depth >= 100 && session.globalLeverage < 100 && (
        <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-amber-950 p-3 rounded-xl border border-amber-500/60 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-3 animate-pulse">
          <div className="space-y-0.5">
            <div className="text-xs font-black text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-400" />
              WEDGE #{session.activeWedgeIndex + 1} AT MAXIMUM DEPTH (100%)
            </div>
            <p className="text-[11px] text-slate-300">
              Current leverage is {Math.round(session.globalLeverage)}% / 100%. Place and hammer additional wedges to reach 100% leverage!
            </p>
          </div>
          {session.wedges.length < 4 ? (
            <button
              onClick={onAddWedge}
              className="py-2 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl border border-amber-400 shadow-md transition flex items-center gap-1.5 shrink-0 cursor-pointer hover:scale-105"
            >
              <Plus className="w-4 h-4" />
              <span>+ SEAT NEXT WEDGE (#{session.wedges.length + 1})</span>
            </button>
          ) : (
            <div className="text-xs font-bold text-sky-400 border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 rounded-lg">
              Switch to an unseated wedge below
            </div>
          )}
        </div>
      )}

      {/* 1. Global Leverage Bar & Cap Line */}
      <div>
        <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
          <div className="flex items-center gap-1.5 text-slate-300">
            <Zap
              className={`w-4 h-4 transition-colors ${
                session.globalLeverage >= 100
                  ? 'text-emerald-400 animate-bounce'
                  : session.globalLeverage >= 45
                  ? 'text-amber-400'
                  : 'text-rose-400'
              }`}
            />
            <span className="font-bold tracking-wider">GLOBAL FRACTURE LEVERAGE</span>
          </div>
          <div
            className={`font-black text-xs px-2.5 py-0.5 rounded-full border transition-all ${
              session.globalLeverage >= 100
                ? 'text-emerald-300 bg-emerald-500/20 border-emerald-500/60 shadow-[0_0_10px_rgba(16,185,129,0.4)]'
                : session.globalLeverage >= 45
                ? 'text-amber-300 bg-amber-500/20 border-amber-500/50'
                : 'text-rose-300 bg-rose-500/20 border-rose-500/50'
            }`}
          >
            {Math.round(session.globalLeverage)}% / 100% {session.globalLeverage >= 100 ? 'READY (GREEN)' : ''}
          </div>
        </div>

        {/* Leverage Track */}
        <div className="relative w-full h-5 bg-slate-950 rounded-full overflow-hidden border border-slate-800 p-0.5 shadow-inner">
          {/* Active leverage fill */}
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              session.globalLeverage >= 100
                ? 'bg-gradient-to-r from-emerald-500 via-green-400 to-teal-300 shadow-[0_0_16px_#10b981]'
                : session.globalLeverage >= 45
                ? 'bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-400'
                : 'bg-gradient-to-r from-rose-700 via-rose-600 to-red-500'
            }`}
            style={{ width: `${Math.min(100, Math.max(2, session.globalLeverage))}%` }}
          />

          {/* Target Green Line at 100% */}
          <div
            className="absolute top-0 bottom-0 right-0 w-1 bg-emerald-400 z-10 shadow-[0_0_8px_#10b981]"
            title="100% Green Target - Crowbar Pry Unlocked"
          />
        </div>

        <div className="flex justify-between text-[10px] font-semibold mt-1">
          <span className="text-rose-400">0% (Low / Red)</span>
          <span className="text-amber-400">50% (Building)</span>
          <span className="text-emerald-400 font-bold">100% (Green / Pry Unlocked!)</span>
        </div>
      </div>

      {/* Crowbar Extraction Interactive Controls (Phase 3) */}
      {session.phase === 'crowbar-prying' && (
        <div className="bg-gradient-to-r from-amber-950/60 via-amber-900/40 to-amber-950/60 p-3 rounded-xl border border-amber-500/50 space-y-2 shadow-lg animate-pulse">
          <div className="flex items-center justify-between text-xs font-black text-amber-300">
            <span className="flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-400" />
              CROWBAR EXTRACTION CONTROLS
            </span>
            <span className="text-[10px] text-amber-200/90 font-semibold">
              Timing: Target Outer Apex (+45% Perfect) or Active Side (+25%)
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                onCrowbarPry('left');
              }}
              className={`py-2.5 px-3 rounded-xl font-black text-xs transition flex flex-col items-center justify-center border cursor-pointer select-none ${
                session.crowbarTargetSide === 'left'
                  ? 'bg-emerald-500 text-slate-950 border-emerald-300 shadow-[0_0_12px_rgba(34,197,94,0.6)] ring-2 ring-emerald-300'
                  : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
              }`}
            >
              <span className="text-sm font-black">← PRY LEFT</span>
              <span className="text-[10px] opacity-80 font-medium">Left Mouse Click OR Key A / ←</span>
            </button>

            <button
              onMouseDown={(e) => {
                e.preventDefault();
                onCrowbarPry('right');
              }}
              onContextMenu={(e) => e.preventDefault()}
              className={`py-2.5 px-3 rounded-xl font-black text-xs transition flex flex-col items-center justify-center border cursor-pointer select-none ${
                session.crowbarTargetSide === 'right'
                  ? 'bg-emerald-500 text-slate-950 border-emerald-300 shadow-[0_0_12px_rgba(34,197,94,0.6)] ring-2 ring-emerald-300'
                  : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
              }`}
            >
              <span className="text-sm font-black">PRY RIGHT →</span>
              <span className="text-[10px] opacity-80 font-medium">Right Mouse Click OR Key D / →</span>
            </button>
          </div>
        </div>
      )}

      {/* 2. Wedge Controls & Status Panels */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-800/80">
        {/* Active Wedge Depth & Stability */}
        <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-300">
            <span>ACTIVE: WEDGE #{session.activeWedgeIndex + 1}</span>
            <span className="text-[10px] text-slate-400">
              {activeWedge?.isSeated ? 'Seated in Seam' : 'Setting in progress'}
            </span>
          </div>

          {/* Depth Bar */}
          <div>
            <div className="flex justify-between text-[11px] text-slate-400 mb-0.5">
              <span>Depth Driven</span>
              <span className="text-slate-200 font-bold">{Math.round(activeWedge?.depth || 0)}%</span>
            </div>
            <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
              <div
                className="h-full bg-sky-500 transition-all duration-200"
                style={{ width: `${activeWedge?.depth || 0}%` }}
              />
            </div>
          </div>

          {/* Stability Bar */}
          <div>
            <div className="flex justify-between text-[11px] text-slate-400 mb-0.5">
              <span>Stability & Alignment</span>
              <span
                className={`font-bold ${
                  (activeWedge?.stability || 0) <= 50 ? 'text-rose-400' : 'text-emerald-400'
                }`}
              >
                {Math.round(activeWedge?.stability || 0)}%
              </span>
            </div>
            <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
              <div
                className={`h-full transition-all duration-200 ${
                  (activeWedge?.stability || 0) <= 50 ? 'bg-rose-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${activeWedge?.stability || 0}%` }}
              />
            </div>
          </div>

          {/* Right-click Reset Option */}
          {activeWedge && activeWedge.stability <= 50 && (
            <button
              onClick={onResetActiveWedge}
              className="w-full mt-1 py-1 px-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer animate-pulse"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Alignment (Restore Stability)
            </button>
          )}
        </div>

        {/* Wedge Switching & Multi-Wedge Selector */}
        <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 space-y-2 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-bold text-slate-300">
            <span className="flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              WEDGE POCKETS
            </span>
            <span className="text-[10px] text-slate-400">{session.wedges.length} Active</span>
          </div>

          {/* Wedges list */}
          <div className="flex items-center gap-2 overflow-x-auto py-1">
            {session.wedges.map((w, idx) => {
              const isSelected = idx === session.activeWedgeIndex;
              const isUnlocked = isWedgeUnlocked(idx, session);

              return (
                <button
                  key={w.id}
                  disabled={!isUnlocked}
                  onClick={() => isUnlocked && onSelectWedge(idx)}
                  className={`flex-1 py-1.5 px-2 rounded-lg border text-xs font-bold transition flex flex-col items-center justify-center cursor-pointer ${
                    !isUnlocked
                      ? 'bg-slate-900/40 text-slate-600 border-slate-800/60 cursor-not-allowed opacity-60'
                      : isSelected
                      ? 'bg-sky-500/25 text-sky-200 border-sky-400 shadow-md ring-1 ring-sky-400/50'
                      : w.isSeated
                      ? 'bg-slate-900/90 text-emerald-300 border-slate-700 hover:bg-slate-800'
                      : 'bg-amber-500/10 text-amber-300 border-amber-500/40 hover:bg-amber-500/20 animate-pulse'
                  }`}
                >
                  <div className="flex items-center gap-1">
                    <span>{!isUnlocked ? '🔒 ' : ''}Wedge #{idx + 1}</span>
                    {isSelected && <span className="text-[9px] text-sky-400 uppercase font-black">(Active)</span>}
                  </div>
                  <span className="text-[10px] text-slate-400 font-normal">
                    {!isUnlocked
                      ? `Unlocks at W#${idx} 80%`
                      : w.isSeated
                      ? `${Math.round(w.depth)}% Driven`
                      : 'Needs Setting'}
                  </span>
                </button>
              );
            })}

            {/* Add new wedge pocket button */}
            {session.wedges.length < 4 && (
              <button
                onClick={onAddWedge}
                title="Seat Additional Wedge"
                className="py-2 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black border border-amber-400 text-xs transition flex items-center justify-center gap-1 cursor-pointer shrink-0 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ W{session.wedges.length + 1}</span>
              </button>
            )}
          </div>

          <p className="text-[10px] text-slate-400 italic">
            Harder rock layers require multiple wedges to surpass the 100% crowbar leverage cap.
          </p>
        </div>

        {/* Specimen Yield & Strike Feedback */}
        <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 space-y-2 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-bold text-slate-300">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              SPECIMEN YIELD
            </span>
            <span className="text-emerald-400 font-bold">{Math.round(session.yieldRemaining)}%</span>
          </div>

          {/* Yield bar */}
          <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
            <div
              className="h-full bg-emerald-400 transition-all duration-300"
              style={{ width: `${session.yieldRemaining}%` }}
            />
          </div>

          {/* Strike Feedback Banner */}
          {session.lastStrikeFeedback ? (
            <div
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold flex items-center justify-between ${getBadgeStyle(
                session.lastStrikeFeedback.tier
              )}`}
            >
              <span>{session.lastStrikeFeedback.text}</span>
              <span className="text-[10px] opacity-80">{session.lastStrikeFeedback.message}</span>
            </div>
          ) : (
            <div className="text-[11px] text-slate-500 italic text-center py-1">
              Ready to strike. Align timing ring for maximum leverage!
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
