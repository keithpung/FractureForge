import React, { useState } from 'react';
import { ProcessingInventory, HammerUpgrade, Specimen } from '../types';
import { soundEngine } from '../utils/audio';
import { Flame, Anvil, Gem, ShieldAlert, Sparkles, Check, ArrowRight, Wrench, Trophy } from 'lucide-react';
import confetti from 'canvas-confetti';

interface WorkbenchProps {
  inventory: ProcessingInventory;
  hammer: HammerUpgrade;
  onUpdateInventory: (newInv: ProcessingInventory) => void;
  onUpdateHammer: (newHammer: HammerUpgrade) => void;
  onClose: () => void;
}

export const Workbench: React.FC<WorkbenchProps> = ({
  inventory,
  hammer,
  onUpdateInventory,
  onUpdateHammer,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'processing' | 'hammer-forge'>('processing');

  // Processing Actions
  const handleCrushSpecimen = (specimenId: string) => {
    const specimen = inventory.specimens.find((s) => s.id === specimenId);
    if (!specimen) return;

    soundEngine.playForgeSound();

    const updatedSpecimens = inventory.specimens.filter((s) => s.id !== specimenId);
    const newInv = { ...inventory, specimens: updatedSpecimens };

    if (specimen.type === 'base-rock') {
      newInv.crushedGravel += Math.round(specimen.weightKg * 10);
      newInv.gold += Math.round(specimen.value * 0.5);
    } else if (specimen.type === 'ore-bearing') {
      const metalKey = specimen.subMaterial?.toLowerCase().includes('iron')
        ? 'iron'
        : specimen.subMaterial?.toLowerCase().includes('copper')
        ? 'copper'
        : specimen.subMaterial?.toLowerCase().includes('gold')
        ? 'gold'
        : specimen.subMaterial?.toLowerCase().includes('titanium')
        ? 'titanium'
        : 'iron';
      newInv.ores[metalKey] = (newInv.ores[metalKey] || 0) + Math.round(specimen.weightKg * 2);
    } else if (specimen.type === 'crystal-bearing') {
      const crystalKey = specimen.subMaterial?.toLowerCase().includes('ruby')
        ? 'ruby'
        : specimen.subMaterial?.toLowerCase().includes('sapphire')
        ? 'sapphire'
        : specimen.subMaterial?.toLowerCase().includes('emerald')
        ? 'emerald'
        : specimen.subMaterial?.toLowerCase().includes('diamond')
        ? 'diamond'
        : 'quartz';
      newInv.rawCrystals[crystalKey] = (newInv.rawCrystals[crystalKey] || 0) + 1;
    }

    onUpdateInventory(newInv);
  };

  const handleSmeltOre = (oreType: string) => {
    if ((inventory.ores[oreType] || 0) < 3) return;
    soundEngine.playForgeSound();

    const newInv = { ...inventory };
    newInv.ores[oreType] -= 3;
    const ingotKey = `${oreType}Ingot`;
    newInv.ingots[ingotKey] = (newInv.ingots[ingotKey] || 0) + 1;
    newInv.gold += 25;

    onUpdateInventory(newInv);
  };

  const handleCutCrystal = (rawCrystalType: string) => {
    if ((inventory.rawCrystals[rawCrystalType] || 0) < 1) return;
    soundEngine.playForgeSound();

    const newInv = { ...inventory };
    newInv.rawCrystals[rawCrystalType] -= 1;
    const cutKey = `cut${rawCrystalType.charAt(0).toUpperCase() + rawCrystalType.slice(1)}`;
    newInv.cutCrystals[cutKey] = (newInv.cutCrystals[cutKey] || 0) + 1;

    onUpdateInventory(newInv);
  };

  // Hammer Upgrade Actions
  const handleUpgradeHead = (mat: HammerUpgrade['headMaterial'], costIngot: string, costAmount: number) => {
    if ((inventory.ingots[costIngot] || 0) < costAmount) return;
    soundEngine.playForgeSound();
    confetti({ particleCount: 50 });

    const newInv = { ...inventory };
    newInv.ingots[costIngot] -= costAmount;
    onUpdateInventory(newInv);

    const newAppraisal = hammer.appraisalValue + costAmount * 150;
    onUpdateHammer({ ...hammer, headMaterial: mat, appraisalValue: newAppraisal });
  };

  const handleUpgradeHandle = (wrap: HammerUpgrade['handleMaterial'], goldCost: number) => {
    if (inventory.gold < goldCost) return;
    soundEngine.playForgeSound();

    const newInv = { ...inventory, gold: inventory.gold - goldCost };
    onUpdateInventory(newInv);

    const newAppraisal = hammer.appraisalValue + goldCost * 2;
    onUpdateHammer({ ...hammer, handleMaterial: wrap, appraisalValue: newAppraisal });
  };

  const handleSocketCrystal = (socketId: string, cutCrystalKey: string) => {
    if ((inventory.cutCrystals[cutCrystalKey] || 0) < 1) return;
    soundEngine.playForgeSound();

    const newInv = { ...inventory };
    newInv.cutCrystals[cutCrystalKey] -= 1;
    onUpdateInventory(newInv);

    const updatedSockets = hammer.sockets.map((s) =>
      s.id === socketId ? { ...s, installedCrystal: cutCrystalKey } : s
    );
    onUpdateHammer({ ...hammer, sockets: updatedSockets, appraisalValue: hammer.appraisalValue + 300 });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-slate-950 p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-gradient-to-tr from-amber-500 to-emerald-500 rounded-xl text-slate-950 font-black">
              <Anvil className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white">WORKBENCH & FORGE</h2>
              <p className="text-xs text-slate-400">Process Specimens, Smelt Ingots & Customization Hub</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('processing')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-2 ${
                activeTab === 'processing'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Flame className="w-4 h-4" />
              Rock Processing
            </button>
            <button
              onClick={() => setActiveTab('hammer-forge')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-2 ${
                activeTab === 'hammer-forge'
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Wrench className="w-4 h-4" />
              Hammer Forge
            </button>
          </div>

          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
          >
            Close ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {activeTab === 'processing' && (
            <div className="space-y-6">
              {/* Unprocessed Specimens Section */}
              <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                    <Anvil className="w-4 h-4 text-amber-400" />
                    Unprocessed Specimens ({inventory.specimens.length})
                  </h3>
                  <span className="text-xs text-amber-400 font-bold">Gold: ${inventory.gold}</span>
                </div>

                {inventory.specimens.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-500 italic">
                    No unextracted rock specimens in inventory. Head back to the Mine Wall to extract rocks!
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {inventory.specimens.map((s) => (
                      <div
                        key={s.id}
                        className="bg-slate-900 border border-slate-800 p-3 rounded-xl flex flex-col justify-between space-y-2 hover:border-slate-700 transition"
                      >
                        <div>
                          <span className="text-[9px] font-bold uppercase text-amber-400 px-1.5 py-0.5 rounded bg-amber-500/10">
                            {s.type}
                          </span>
                          <h4 className="text-xs font-bold text-slate-100 mt-1">{s.name}</h4>
                          <p className="text-[10px] text-slate-400 mt-0.5">{s.subMaterial || 'Base Specimen'}</p>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                          <span className="text-[10px] text-slate-400 font-bold">{s.weightKg} kg</span>
                          <button
                            onClick={() => handleCrushSpecimen(s.id)}
                            className="px-2.5 py-1 bg-gradient-to-r from-amber-500 to-emerald-500 hover:scale-105 text-slate-950 font-black text-[10px] uppercase rounded-lg transition cursor-pointer"
                          >
                            Process Specimen
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Ore Smelting Crucible & Gem Cutting */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Ore Crucible */}
                <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-3">
                  <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                    <Flame className="w-4 h-4 text-orange-500" />
                    Crucible Smelting
                  </h3>
                  <p className="text-[11px] text-slate-400">Fill crucible with 3 Ore units to forge an Ingot.</p>

                  <div className="space-y-2">
                    {['iron', 'copper', 'gold', 'titanium'].map((metal) => {
                      const count = inventory.ores[metal] || 0;
                      const ingotCount = inventory.ingots[`${metal}Ingot`] || 0;
                      return (
                        <div
                          key={metal}
                          className="flex items-center justify-between p-2.5 bg-slate-900 rounded-xl border border-slate-800 text-xs"
                        >
                          <div>
                            <span className="font-bold text-slate-200 capitalize">{metal} Ore</span>
                            <span className="text-[10px] text-slate-400 ml-2">({count} units available)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-emerald-400 font-bold">{ingotCount} Ingots</span>
                            <button
                              disabled={count < 3}
                              onClick={() => handleSmeltOre(metal)}
                              className="px-2 py-1 rounded-lg bg-orange-500 hover:bg-orange-400 disabled:opacity-30 text-slate-950 font-bold text-[10px] uppercase transition cursor-pointer"
                            >
                              Smelt (3 Ore)
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Gem Chiseling & Cutting */}
                <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-3">
                  <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                    <Gem className="w-4 h-4 text-fuchsia-400" />
                    Crystal Lapidary & Cutting
                  </h3>
                  <p className="text-[11px] text-slate-400">Cut raw crystal specimens to socket into your hammer.</p>

                  <div className="space-y-2">
                    {['quartz', 'ruby', 'sapphire', 'emerald', 'diamond'].map((cType) => {
                      const rawCount = inventory.rawCrystals[cType] || 0;
                      const cutKey = `cut${cType.charAt(0).toUpperCase() + cType.slice(1)}`;
                      const cutCount = inventory.cutCrystals[cutKey] || 0;
                      return (
                        <div
                          key={cType}
                          className="flex items-center justify-between p-2.5 bg-slate-900 rounded-xl border border-slate-800 text-xs"
                        >
                          <div>
                            <span className="font-bold text-slate-200 capitalize">Raw {cType}</span>
                            <span className="text-[10px] text-slate-400 ml-2">({rawCount} raw)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-fuchsia-400 font-bold">{cutCount} Cut</span>
                            <button
                              disabled={rawCount < 1}
                              onClick={() => handleCutCrystal(cType)}
                              className="px-2 py-1 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-30 text-white font-bold text-[10px] uppercase transition cursor-pointer"
                            >
                              Cut Gem
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'hammer-forge' && (
            <div className="space-y-6">
              {/* Hammer Overview Banner */}
              <div className="bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-950 p-5 rounded-2xl border border-indigo-500/30 flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-extrabold uppercase text-amber-400 tracking-widest bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    The Main Character
                  </span>
                  <h3 className="text-xl font-black text-white">
                    {hammer.inlay !== 'None' ? `${hammer.inlay} ` : ''}
                    {hammer.headMaterial} Striking Hammer
                  </h3>
                  <p className="text-xs text-slate-300">
                    Handle: <span className="text-indigo-300 font-bold">{hammer.handleMaterial}</span> | Sockets:{' '}
                    <span className="text-emerald-300 font-bold">{hammer.sockets.length} Installed</span>
                  </p>
                </div>

                <div className="flex items-center gap-4 bg-slate-900/80 px-4 py-2.5 rounded-xl border border-slate-800">
                  <div className="text-right">
                    <div className="text-[10px] text-slate-400 uppercase font-bold">Appraisal Rating</div>
                    <div className="text-lg font-black text-amber-400">${hammer.appraisalValue}</div>
                  </div>
                  <Trophy className="w-8 h-8 text-amber-400" />
                </div>
              </div>

              {/* Head Material Upgrade Options */}
              <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Hammer Head Upgrades</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { mat: 'Iron', costIngot: 'ironIngot', amount: 1 },
                    { mat: 'Bronze', costIngot: 'copperIngot', amount: 2 },
                    { mat: 'Steel', costIngot: 'ironIngot', amount: 4 },
                    { mat: 'Titanium', costIngot: 'titaniumIngot', amount: 3 },
                    { mat: 'Mithril', costIngot: 'goldIngot', amount: 5 },
                  ].map((upgrade) => {
                    const isCurrent = hammer.headMaterial === upgrade.mat;
                    const availableIngots = inventory.ingots[upgrade.costIngot] || 0;
                    return (
                      <div
                        key={upgrade.mat}
                        className={`p-3 rounded-xl border flex flex-col justify-between space-y-2 ${
                          isCurrent
                            ? 'bg-emerald-500/10 border-emerald-500/50'
                            : 'bg-slate-900 border-slate-800'
                        }`}
                      >
                        <div>
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-xs text-slate-100">{upgrade.mat} Head</span>
                            {isCurrent && <span className="text-[10px] text-emerald-400 font-bold">Equipped</span>}
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1">
                            Requires {upgrade.amount} {upgrade.costIngot.replace('Ingot', '')} Ingots
                          </p>
                        </div>

                        {!isCurrent && (
                          <button
                            disabled={availableIngots < upgrade.amount}
                            onClick={() =>
                              handleUpgradeHead(
                                upgrade.mat as HammerUpgrade['headMaterial'],
                                upgrade.costIngot,
                                upgrade.amount
                              )
                            }
                            className="w-full py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-30 text-slate-950 font-bold text-[10px] uppercase transition cursor-pointer"
                          >
                            Forge Head
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Socketing Cut Gemstones */}
              <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Crystal Socketing</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {hammer.sockets.map((socket) => (
                    <div
                      key={socket.id}
                      className="p-3 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-between space-x-3"
                    >
                      <div>
                        <div className="text-xs font-bold text-slate-100">{socket.name}</div>
                        <div className="text-[10px] text-slate-400">
                          {socket.installedCrystal
                            ? `Installed: ${socket.installedCrystal}`
                            : 'Empty Socket'}
                        </div>
                      </div>

                      {!socket.installedCrystal && (
                        <div className="flex items-center gap-1">
                          {['cutRuby', 'cutSapphire', 'cutEmerald', 'cutDiamond'].map((cKey) => {
                            const count = inventory.cutCrystals[cKey] || 0;
                            return (
                              <button
                                key={cKey}
                                disabled={count < 1}
                                onClick={() => handleSocketCrystal(socket.id, cKey)}
                                title={`Socket ${cKey}`}
                                className="px-2 py-1 bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-30 text-white rounded font-bold text-[9px] uppercase cursor-pointer"
                              >
                                {cKey.replace('cut', '')}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
