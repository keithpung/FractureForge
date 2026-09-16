import React from 'react';
import { BookOpen, ShieldAlert, Zap, Hammer, Layers, RotateCcw, Flame } from 'lucide-react';

interface GDDGuideModalProps {
  onClose: () => void;
}

export const GDDGuideModal: React.FC<GDDGuideModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-slate-950 p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-400">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white">FRACTUREFORGE - LIVING GDD GUIDE</h2>
              <p className="text-xs text-slate-400">Extraction Mechanics, Wedge Setting & Hammer Progression</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
          >
            Close ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-300 leading-relaxed">
          {/* Section 1 */}
          <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-2">
            <h3 className="font-extrabold text-sm text-cyan-400 flex items-center gap-2">
              <Zap className="w-4 h-4" />
              1. Wedge Setting (3-Target Circle)
            </h3>
            <p>
              When seating a new wedge along the rock seam, a moving hit marker orbits around a circular target ring. Three color-gradient target arcs appear. Tap SPACE or Click when the marker aligns with the green center line.
            </p>
            <ul className="list-disc pl-5 space-y-1 text-slate-400">
              <li>Three perfect taps establish maximum first-wedge leverage cap (up to ~70%).</li>
              <li>Lower accuracy scales the leverage cap downward.</li>
            </ul>
          </div>

          {/* Section 2 */}
          <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-2">
            <h3 className="font-extrabold text-sm text-amber-400 flex items-center gap-2">
              <Hammer className="w-4 h-4" />
              2. Compounding Hammer Strikes
            </h3>
            <p>
              A shrinking target circle contracts inward towards the active wedge head. Strike when the circle matches the inner green target ring.
            </p>
            <ul className="list-disc pl-5 space-y-1 text-slate-400">
              <li><strong className="text-slate-200">1st Perfect Strike:</strong> Realizes ~15% of wedge depth cap.</li>
              <li><strong className="text-slate-200">2nd Consecutive Perfect:</strong> Compounds to ~45% depth cap.</li>
              <li><strong className="text-slate-200">3rd Consecutive Perfect:</strong> 100% wedge depth cap reached!</li>
              <li><strong className="text-rose-400">Poor Hits:</strong> Produce side-crack overlays, reduce stability, and reduce specimen yield!</li>
            </ul>
          </div>

          {/* Section 3 */}
          <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-2">
            <h3 className="font-extrabold text-sm text-rose-400 flex items-center gap-2">
              <RotateCcw className="w-4 h-4" />
              3. Right-Click Reset (50% Stability Loss)
            </h3>
            <p>
              If wedge stability drops to 50% or below due to bad strikes, right-click the unstable wedge (or press the Reset button) to reopen the 3-target setting minigame. A successful reset restores alignment & stability while sacrificing a small portion of depth.
            </p>
          </div>

          {/* Section 4 */}
          <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-2">
            <h3 className="font-extrabold text-sm text-emerald-400 flex items-center gap-2">
              <Layers className="w-4 h-4" />
              4. Multi-Wedge Pockets & Crowbar Extraction
            </h3>
            <p>
              Harder rocks require multiple coordinated wedges to raise total Global Leverage past 100%. Once 100% leverage is reached, the Crowbar Pry phase unlocks! Alternate timing clicks to pry the stone free and spawn your collectible specimen.
            </p>
          </div>

          {/* Section 5 */}
          <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-2">
            <h3 className="font-extrabold text-sm text-fuchsia-400 flex items-center gap-2">
              <Flame className="w-4 h-4" />
              5. The Workbench & Hammer Customization
            </h3>
            <p>
              Take extracted specimens to the Workbench to crush base rock, smelt ore ingots in crucibles, and cut raw crystals. Customizing your hammer head, handle wrap, inlays, and sockets boosts overall Appraisal Rating and Mining Power!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
