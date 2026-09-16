import React from 'react';
import { DepositType, GameSettings } from '../types';
import { Pickaxe, Anvil, Package, Volume2, VolumeX, Music, BookOpen, Mountain } from 'lucide-react';

interface NavbarProps {
  depositType: DepositType;
  onSelectDeposit: (type: DepositType) => void;
  settings: GameSettings;
  onUpdateSettings: (newSettings: Partial<GameSettings>) => void;
  onOpenWorkbench: () => void;
  onOpenInventory: () => void;
  onOpenGuide: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  depositType,
  onSelectDeposit,
  settings,
  onUpdateSettings,
  onOpenWorkbench,
  onOpenInventory,
  onOpenGuide,
}) => {
  const depositOptions: { id: DepositType; name: string; hardness: string; color: string }[] = [
    { id: 'sandstone', name: 'Sandstone Quarry', hardness: 'Soft (1-2 Wedges)', color: 'text-amber-400' },
    { id: 'granite', name: 'Granite Crag', hardness: 'Medium (2-3 Wedges)', color: 'text-slate-300' },
    { id: 'limestone', name: 'Limestone Vault', hardness: 'Hard (3-5 Wedges)', color: 'text-cyan-300' },
  ];

  return (
    <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 text-white sticky top-0 z-40 px-4 py-3 shadow-lg">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <div className="bg-gradient-to-tr from-amber-500 via-orange-500 to-emerald-500 p-2 rounded-xl shadow-md flex items-center justify-center">
            <Pickaxe className="w-6 h-6 text-slate-950 font-black animate-pulse" />
          </div>
          <div>
            <h1 className="font-black text-lg tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-amber-400 via-emerald-300 to-cyan-400">
              FRACTUREFORGE
            </h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
              Rock Extraction & Hammer Forge
            </p>
          </div>
        </div>

        {/* Deposit Location Selector */}
        <div className="flex items-center gap-1.5 bg-slate-950/70 p-1.5 rounded-xl border border-slate-800">
          <Mountain className="w-4 h-4 text-slate-400 ml-1" />
          {depositOptions.map((dep) => {
            const active = depositType === dep.id;
            return (
              <button
                key={dep.id}
                onClick={() => onSelectDeposit(dep.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex flex-col items-center cursor-pointer ${
                  active
                    ? 'bg-slate-800 text-white border border-slate-700 shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span className={active ? dep.color : ''}>{dep.name}</span>
                <span className="text-[9px] font-normal opacity-70">{dep.hardness}</span>
              </button>
            );
          })}
        </div>

        {/* Actions & Utilities */}
        <div className="flex items-center gap-2">
          {/* Audio Toggles */}
          <button
            onClick={() => onUpdateSettings({ soundEnabled: !settings.soundEnabled })}
            title={settings.soundEnabled ? 'Mute SFX' : 'Unmute SFX'}
            className={`p-2 rounded-lg border transition cursor-pointer ${
              settings.soundEnabled
                ? 'bg-slate-800 text-cyan-400 border-slate-700'
                : 'bg-slate-900 text-slate-500 border-slate-800'
            }`}
          >
            {settings.soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          <button
            onClick={() => onUpdateSettings({ musicEnabled: !settings.musicEnabled })}
            title={settings.musicEnabled ? 'Mute Cavern Drone' : 'Unmute Cavern Drone'}
            className={`p-2 rounded-lg border transition cursor-pointer ${
              settings.musicEnabled
                ? 'bg-slate-800 text-amber-400 border-slate-700'
                : 'bg-slate-900 text-slate-500 border-slate-800'
            }`}
          >
            <Music className="w-4 h-4" />
          </button>

          {/* Workbench button */}
          <button
            onClick={onOpenWorkbench}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black text-xs uppercase tracking-wider shadow-md hover:scale-105 transition cursor-pointer"
          >
            <Anvil className="w-4 h-4" />
            <span className="hidden sm:inline">Workbench</span>
          </button>

          {/* Inventory button */}
          <button
            onClick={onOpenInventory}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition cursor-pointer"
          >
            <Package className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">Vault</span>
          </button>

          {/* GDD Rules Guide */}
          <button
            onClick={onOpenGuide}
            title="Living GDD Rules"
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer"
          >
            <BookOpen className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
