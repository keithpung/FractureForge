import React from 'react';
import { ProcessingInventory } from '../types';
import { Package, Gem, Coins, Flame, Trophy, Scale } from 'lucide-react';

interface InventoryJournalProps {
  inventory: ProcessingInventory;
  onClose: () => void;
}

export const InventoryJournal: React.FC<InventoryJournalProps> = ({ inventory, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-slate-950 p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white">COLLECTION & INVENTORY</h2>
              <p className="text-xs text-slate-400">Extracted Specimen Vault & Processed Material Reserves</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
          >
            Close ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Summary Stat Pills */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 flex items-center gap-3">
              <Coins className="w-5 h-5 text-amber-400" />
              <div>
                <div className="text-[10px] text-slate-400 font-bold uppercase">Gold Coins</div>
                <div className="text-sm font-extrabold text-amber-400">${inventory.gold}</div>
              </div>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 flex items-center gap-3">
              <Scale className="w-5 h-5 text-cyan-400" />
              <div>
                <div className="text-[10px] text-slate-400 font-bold uppercase">Crushed Gravel</div>
                <div className="text-sm font-extrabold text-slate-100">{inventory.crushedGravel} kg</div>
              </div>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 flex items-center gap-3">
              <Trophy className="w-5 h-5 text-emerald-400" />
              <div>
                <div className="text-[10px] text-slate-400 font-bold uppercase">Specimens Vault</div>
                <div className="text-sm font-extrabold text-emerald-400">{inventory.specimens.length} items</div>
              </div>
            </div>
          </div>

          {/* Specimens List */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Extracted Rock Specimens</h3>
            {inventory.specimens.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500 italic bg-slate-950/40 rounded-xl border border-slate-800/80">
                No rock specimens currently stored. Mine new deposits to collect rare crystals, ores, and sandstone slabs!
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {inventory.specimens.map((spec) => (
                  <div
                    key={spec.id}
                    className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 flex items-center space-x-3"
                  >
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-slate-950 shadow-md"
                      style={{ backgroundColor: spec.color }}
                    >
                      🪨
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-slate-100 truncate">{spec.name}</div>
                      <div className="text-[10px] text-slate-400">
                        {spec.weightKg} kg • Yield: {spec.yieldAmount}%
                      </div>
                    </div>
                    <div className="text-xs font-bold text-amber-400">${spec.value}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Processed Ores & Crystals Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-2">
              <h4 className="text-xs font-bold text-slate-300 flex items-center gap-2">
                <Flame className="w-4 h-4 text-orange-400" />
                Forged Ingots
              </h4>
              <div className="space-y-1.5 text-xs">
                {Object.entries(inventory.ingots).map(([k, v]) => (
                  <div key={k} className="flex justify-between p-2 bg-slate-900 rounded-lg border border-slate-800">
                    <span className="capitalize text-slate-300">{k.replace('Ingot', ' Ingot')}</span>
                    <span className="font-bold text-amber-400">{v}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-2">
              <h4 className="text-xs font-bold text-slate-300 flex items-center gap-2">
                <Gem className="w-4 h-4 text-fuchsia-400" />
                Cut Gemstones
              </h4>
              <div className="space-y-1.5 text-xs">
                {Object.entries(inventory.cutCrystals).map(([k, v]) => (
                  <div key={k} className="flex justify-between p-2 bg-slate-900 rounded-lg border border-slate-800">
                    <span className="capitalize text-slate-300">{k.replace('cut', 'Cut ')}</span>
                    <span className="font-bold text-fuchsia-400">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
