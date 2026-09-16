import React from 'react';
import { Specimen } from '../types';
import { Gem, Hammer, Sparkles, Scale, Coins, CheckCircle, ArrowRight } from 'lucide-react';
import confetti from 'canvas-confetti';

interface SpecimenInspectModalProps {
  specimen: Specimen;
  onClose: () => void;
  onGoToWorkbench: () => void;
}

export const SpecimenInspectModal: React.FC<SpecimenInspectModalProps> = ({
  specimen,
  onClose,
  onGoToWorkbench,
}) => {
  React.useEffect(() => {
    // Fire celebratory confetti on specimen extraction modal opening
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
    });
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative overflow-hidden space-y-6">
        {/* Glow Header */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-amber-500 via-emerald-400 to-cyan-500" />

        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-400">
              <Sparkles className="w-7 h-7 animate-pulse" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                {specimen.type.replace('-', ' ')}
              </span>
              <h2 className="text-xl font-black text-white mt-0.5">{specimen.name}</h2>
            </div>
          </div>
        </div>

        {/* Specimen Visual Preview Box */}
        <div className="relative bg-slate-950 rounded-2xl border border-slate-800 p-8 flex flex-col items-center justify-center overflow-hidden">
          {/* Radial light aura */}
          <div
            className="absolute inset-0 opacity-20 pointer-events-none"
            style={{
              background: `radial-gradient(circle, ${specimen.color} 0%, transparent 70%)`,
            }}
          />

          {/* Render 3D-ish Rock Specimen Polygon */}
          <div className="relative z-10 my-4 transform hover:scale-105 transition duration-300">
            <svg width="140" height="120" viewBox="0 0 140 120" className="drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)]">
              <polygon points="30,20 70,5 120,30 130,85 80,115 15,95" fill={specimen.color} stroke="#ffffff" strokeWidth="2" />
              <polygon points="30,20 70,5 80,60 15,95" fill="rgba(255,255,255,0.15)" />
              <polygon points="70,5 120,30 130,85 80,60" fill="rgba(0,0,0,0.25)" />
            </svg>
          </div>

          <p className="text-xs text-slate-300 text-center max-w-sm mt-2 italic">
            "{specimen.description}"
          </p>
        </div>

        {/* Specimen Properties */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 flex items-center space-x-3">
            <Scale className="w-5 h-5 text-cyan-400" />
            <div>
              <div className="text-[10px] text-slate-400 font-semibold uppercase">Specimen Weight</div>
              <div className="text-sm font-bold text-slate-100">{specimen.weightKg} kg</div>
            </div>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 flex items-center space-x-3">
            <Coins className="w-5 h-5 text-amber-400" />
            <div>
              <div className="text-[10px] text-slate-400 font-semibold uppercase">Appraisal Value</div>
              <div className="text-sm font-bold text-amber-400">${specimen.value}</div>
            </div>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 flex items-center space-x-3">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
            <div>
              <div className="text-[10px] text-slate-400 font-semibold uppercase">Yield Quality</div>
              <div className="text-sm font-bold text-emerald-300">{specimen.yieldAmount}% Intact</div>
            </div>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 flex items-center space-x-3">
            <Gem className="w-5 h-5 text-fuchsia-400" />
            <div>
              <div className="text-[10px] text-slate-400 font-semibold uppercase">Sub-Material</div>
              <div className="text-xs font-bold text-fuchsia-300 truncate">{specimen.subMaterial || 'Standard Specimen'}</div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs uppercase tracking-wider transition cursor-pointer"
          >
            Store in Inventory
          </button>
          <button
            onClick={onGoToWorkbench}
            className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-emerald-500 hover:from-amber-400 hover:to-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <Hammer className="w-4 h-4" />
            Process at Workbench →
          </button>
        </div>
      </div>
    </div>
  );
};
