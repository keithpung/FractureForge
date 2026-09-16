import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  DepositType,
  MiningSessionState,
  ProcessingInventory,
  HammerUpgrade,
  TargetArc,
  AccuracyTier,
  Specimen,
  GameSettings,
} from './types';
import { RockWallCanvas } from './components/RockWallCanvas';
import { MiningHUD } from './components/MiningHUD';
import { Navbar } from './components/Navbar';
import { SpecimenInspectModal } from './components/SpecimenInspectModal';
import { Workbench } from './components/Workbench';
import { InventoryJournal } from './components/InventoryJournal';
import { GDDGuideModal } from './components/GDDGuideModal';
import { soundEngine } from './utils/audio';

// Helper to generate 3 random non-overlapping target arcs for wedge setting
const generateTargetArcs = (): TargetArc[] => {
  const arcs: TargetArc[] = [];
  const baseAngles = [45, 160, 280]; // spaced out around 360 deg circle
  baseAngles.forEach((base) => {
    const jitter = (Math.random() - 0.5) * 40;
    const centerAngle = (base + jitter + 360) % 360;
    const arcWidth = 50; // 50 degrees total arc width
    arcs.push({
      startAngle: (centerAngle - arcWidth / 2 + 360) % 360,
      arcWidth,
      centerAngle,
    });
  });
  return arcs;
};

// Initial default session setup
const createInitialSession = (depositType: DepositType, workAreaIndex = 0): MiningSessionState => {
  const hardnessRating = depositType === 'sandstone' ? 1 : depositType === 'granite' ? 2 : 3;

  return {
    depositType,
    hardnessRating,
    workAreaIndex,
    totalWorkAreas: 5,
    phase: 'wedge-setting',
    wedges: [
      {
        id: 0,
        x: 28,
        y: 60,
        angle: 15,
        setQuality: 0,
        maxCapContribution: 33.3,
        depth: 0,
        stability: 100,
        isSeated: false,
        consecutivePerfects: 0,
      },
      {
        id: 1,
        x: 68,
        y: 56,
        angle: 15,
        setQuality: 0,
        maxCapContribution: 33.3,
        depth: 0,
        stability: 100,
        isSeated: false,
        consecutivePerfects: 0,
      },
      {
        id: 2,
        x: 48,
        y: 26,
        angle: 45,
        setQuality: 0,
        maxCapContribution: 33.4,
        depth: 0,
        stability: 100,
        isSeated: false,
        consecutivePerfects: 0,
      },
    ],
    activeWedgeIndex: 0,
    unlockedWedgeCount: 3,
    targetArcs: generateTargetArcs(),
    markerAngle: 0,
    settingStep: 0,
    settingAccuracies: [],
    circleRadius: 90,
    isCircleShrinking: true,
    crowbarProgress: 0,
    crowbarTargetSide: 'left',
    crowbarPosition: 0,
    crowbarDirection: 1,
    crowbarConsecutiveMisses: 0,
    globalLeverage: 0,
    leverageCap: 0,
    yieldRemaining: 100,
    sideCrackCount: 0,
    cracks: [],
    lastStrikeFeedback: null,
    extractedSpecimen: null,
  };
};

export default function App() {
  // Global App States
  const [session, setSession] = useState<MiningSessionState>(() => createInitialSession('sandstone'));
  const [settings, setSettings] = useState<GameSettings>({
    soundEnabled: true,
    musicEnabled: true,
    volume: 0.5,
    particleDensity: 'high',
  });

  // Persistent Player Inventory
  const [inventory, setInventory] = useState<ProcessingInventory>({
    specimens: [
      {
        id: 'spec-sample-1',
        name: 'Sedimentary Quartz Slab',
        type: 'base-rock',
        depositType: 'sandstone',
        quality: 85,
        yieldAmount: 92,
        weightKg: 14.5,
        value: 120,
        color: '#d97706',
        subMaterial: 'Quartz Grain Sandstone',
        description: 'Layered sandstone sample rich with glittering quartz crystal specks.',
        dateExtracted: new Date().toISOString(),
      },
    ],
    crushedGravel: 45,
    ores: { iron: 4, copper: 6, gold: 1, titanium: 0 },
    ingots: { ironIngot: 2, copperIngot: 1 },
    rawCrystals: { quartz: 2, ruby: 1 },
    cutCrystals: { cutQuartz: 1 },
    gold: 350,
  });

  // Main Character: The Hammer
  const [hammer, setHammer] = useState<HammerUpgrade>({
    headMaterial: 'Iron',
    handleMaterial: 'Ash Wood',
    inlay: 'None',
    sockets: [
      { id: 'socket-head-1', name: 'Head Socket', slotType: 'head', installedCrystal: 'cutQuartz', buffDescription: '+10% Precision' },
      { id: 'socket-pommel-1', name: 'Pommel Socket', slotType: 'pommel', installedCrystal: null, buffDescription: '+15% Stability Retain' },
    ],
    appraisalValue: 450,
  });

  // UI Modals
  const [showSpecimenModal, setShowSpecimenModal] = useState<boolean>(false);
  const [showWorkbench, setShowWorkbench] = useState<boolean>(false);
  const [showInventory, setShowInventory] = useState<boolean>(false);
  const [showGuideModal, setShowGuideModal] = useState<boolean>(false);

  // Animation Loop Ref
  const animRef = useRef<number | null>(null);

  // Sync Settings to Audio Engine
  useEffect(() => {
    soundEngine.setMuted(!settings.soundEnabled);
    soundEngine.setMusicMuted(!settings.musicEnabled);
    if (settings.musicEnabled) {
      soundEngine.startAmbient();
    } else {
      soundEngine.stopAmbient();
    }
  }, [settings]);

  // Continuous Game Tickers for Minigames (Marker Rotation, Shrinking Circle, Crowbar Oscillation)
  useEffect(() => {
    let lastTime = performance.now();

    const tick = (now: number) => {
      const delta = (now - lastTime) / 1000;
      lastTime = now;

      setSession((prev) => {
        if (prev.phase === 'wedge-setting') {
          // Rotate target hit marker around 360 degrees
          const newAngle = (prev.markerAngle + 180 * delta) % 360;
          return { ...prev, markerAngle: newAngle };
        } else if (prev.phase === 'hammering') {
          // Shrink target circle from 90 down to 10px, then reset
          let newR = prev.circleRadius - 70 * delta;
          if (newR <= 10) {
            newR = 90;
          }
          return { ...prev, circleRadius: newR };
        } else if (prev.phase === 'crowbar-prying') {
          // Smooth Ping-Pong: Oscillate crowbar indicator left to right (+100) then bounce back right to left (-100)
          let dir = prev.crowbarDirection || 1;
          const speed = 170; // units per second
          let newPos = prev.crowbarPosition + speed * dir * delta;

          if (newPos >= 100) {
            newPos = 100;
            dir = -1;
          } else if (newPos <= -100) {
            newPos = -100;
            dir = 1;
          }

          const targetSide = newPos < 0 ? 'left' : 'right';

          return {
            ...prev,
            crowbarPosition: newPos,
            crowbarDirection: dir,
            crowbarTargetSide: targetSide,
          };
        }
        return prev;
      });

      animRef.current = requestAnimationFrame(tick);
    };

    animRef.current = requestAnimationFrame(tick);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);

  // Handler: Change Deposit Location
  const handleSelectDeposit = (type: DepositType) => {
    setSession(createInitialSession(type, 0));
  };

  // Handler: Phase 1 Target Arc Tap (Wedge Setting)
  const handleTargetTap = useCallback(() => {
    setSession((prev) => {
      if (prev.phase !== 'wedge-setting') return prev;

      const currentArc = prev.targetArcs[prev.settingStep];
      if (!currentArc) return prev;

      // Calculate accuracy relative to arc center angle
      const diff = Math.abs((prev.markerAngle - currentArc.centerAngle + 360) % 360);
      const normalizedDiff = diff > 180 ? 360 - diff : diff;

      let accuracy = Math.max(0, 100 - normalizedDiff * 3.5);
      let tier: AccuracyTier = 'miss';

      if (accuracy >= 95) tier = 'perfect';
      else if (accuracy >= 85) tier = 'great';
      else if (accuracy >= 70) tier = 'good';
      else if (accuracy >= 55) tier = 'okay';
      else if (accuracy >= 40) tier = 'bad';
      else if (accuracy >= 25) tier = 'horrible';

      soundEngine.playTargetTap(tier);

      const updatedAccuracies = [...prev.settingAccuracies, accuracy];
      const nextStep = prev.settingStep + 1;

      // Check if finished 3 target setting taps for current wedge
      if (nextStep >= 3) {
        const avgSetQuality = updatedAccuracies.reduce((a, b) => a + b, 0) / 3 / 100;

        // Update active wedge as seated
        const updatedWedges = prev.wedges.map((w, idx) => {
          if (idx === prev.activeWedgeIndex) {
            const share = 100 / prev.wedges.length;
            const capContrib = share * Math.max(0.85, avgSetQuality);
            return {
              ...w,
              isSeated: true,
              setQuality: avgSetQuality,
              maxCapContribution: capContrib,
            };
          }
          return w;
        });

        // Recalculate total leverage cap and leverage
        const totalCap = updatedWedges.reduce((sum, w) => sum + (w.isSeated ? w.maxCapContribution : 0), 0);
        const currentLeverage = updatedWedges.reduce(
          (sum, w) => sum + (w.isSeated ? (w.depth / 100) * w.maxCapContribution : 0),
          0
        );

        return {
          ...prev,
          phase: 'hammering',
          wedges: updatedWedges,
          leverageCap: totalCap,
          globalLeverage: currentLeverage,
          settingStep: 0,
          settingAccuracies: [],
          lastStrikeFeedback: {
            tier,
            text: `WEDGE #${prev.activeWedgeIndex + 1} SEATED! (${Math.round(avgSetQuality * 100)}% Quality)`,
            message: `Hammer wedge to build leverage towards 100%!`,
            time: Date.now(),
          },
        };
      }

      return {
        ...prev,
        settingStep: nextStep,
        settingAccuracies: updatedAccuracies,
        lastStrikeFeedback: {
          tier,
          text: `TAP ${nextStep}/3: ${tier.toUpperCase()}!`,
          message: `${Math.round(accuracy)}% Accuracy`,
          time: Date.now(),
        },
      };
    });
  }, []);

  // Handler: Phase 2 Hammer Strike (Compounding Progression)
  const handleHammerStrike = useCallback(() => {
    setSession((prev) => {
      if (prev.phase !== 'hammering') return prev;

      const activeW = prev.wedges[prev.activeWedgeIndex];
      if (!activeW || !activeW.isSeated) return prev;

      const r = prev.circleRadius;
      let accuracyRatio = 0;
      let tier: AccuracyTier = 'miss';

      if (r <= 22) {
        accuracyRatio = 1.0;
        tier = 'perfect';
      } else if (r <= 38) {
        accuracyRatio = 0.85;
        tier = 'great';
      } else if (r <= 52) {
        accuracyRatio = 0.7;
        tier = 'good';
      } else if (r <= 68) {
        accuracyRatio = 0.5;
        tier = 'okay';
      } else if (r <= 80) {
        accuracyRatio = 0.25;
        tier = 'bad';
      } else if (r <= 88) {
        accuracyRatio = 0.1;
        tier = 'horrible';
      } else {
        accuracyRatio = 0.0;
        tier = 'miss';
      }

      soundEngine.playHammerStrike(accuracyRatio);

      // Compounding 3-Hit Progression Logic:
      let streak = tier === 'perfect' ? activeW.consecutivePerfects + 1 : 0;
      let depthGainPercent = 15;
      if (streak === 2) depthGainPercent = 30; // compounds to 45% total
      if (streak >= 3) depthGainPercent = 55; // compounds to 100% total cap!

      depthGainPercent *= accuracyRatio;

      const newDepth = Math.min(100, activeW.depth + depthGainPercent);

      const isPoorHit = tier === 'bad' || tier === 'horrible' || tier === 'miss';

      // Stability loss on strikes (reflects mechanical stress on the rock wall)
      let stabilityLoss = 4; // Baseline rock stress per strike
      if (isPoorHit) stabilityLoss = 32;
      else if (tier === 'okay') stabilityLoss = 16;
      else if (tier === 'great') stabilityLoss = 8;

      const newStability = Math.max(0, activeW.stability - stabilityLoss);

      // Side crack overlay & yield loss on poor strikes
      let newYield = prev.yieldRemaining;
      let newCracks = [...prev.cracks];
      if (isPoorHit) {
        newYield = Math.max(15, prev.yieldRemaining - 14);

        const crackId = `miss-crack-wedge-${prev.activeWedgeIndex}`;
        const existingCrackIdx = newCracks.findIndex((c) => c.id === crackId);

        // Direction vector radiating outwards away from center (50, 45)
        const dirX = activeW.x - 50;
        const dirY = activeW.y - 45;
        const len = Math.hypot(dirX, dirY) || 1;
        const normX = dirX / len;
        const normY = dirY / len;
        const perpX = -normY;
        const perpY = normX;

        if (existingCrackIdx >= 0) {
          // Grow existing crack on repeated miss hits!
          const targetCrack = { ...newCracks[existingCrackIdx] };
          const currentPath = [...targetCrack.path];
          const lastPt = currentPath[currentPath.length - 1];

          let currX = lastPt.x;
          let currY = lastPt.y;
          for (let step = 0; step < 3; step++) {
            const stepDist = 5 + Math.random() * 4;
            const jitter = (Math.random() - 0.5) * 8;
            currX = Math.max(5, Math.min(95, currX + normX * stepDist + perpX * jitter));
            currY = Math.max(5, Math.min(95, currY + normY * stepDist + perpY * jitter));
            currentPath.push({ x: currX, y: currY });
          }

          targetCrack.path = currentPath;
          targetCrack.width = Math.min(8, targetCrack.width + 1.8);
          targetCrack.opacity = Math.min(1.0, targetCrack.opacity + 0.15);
          newCracks[existingCrackIdx] = targetCrack;
        } else {
          // Create a brand new jagged rock crack radiating from active wedge
          const initialPath = [{ x: activeW.x, y: activeW.y }];
          let currX = activeW.x;
          let currY = activeW.y;
          for (let step = 0; step < 4; step++) {
            const stepDist = 4 + Math.random() * 5;
            const jitter = (Math.random() - 0.5) * 8;
            currX = Math.max(5, Math.min(95, currX + normX * stepDist + perpX * jitter));
            currY = Math.max(5, Math.min(95, currY + normY * stepDist + perpY * jitter));
            initialPath.push({ x: currX, y: currY });
          }

          newCracks.push({
            id: crackId,
            type: 'side',
            path: initialPath,
            width: 3.5,
            opacity: 0.85,
            color: '#dc2626',
          });
        }
      }

      // Update active wedge state
      const updatedWedges = prev.wedges.map((w, idx) => {
        if (idx === prev.activeWedgeIndex) {
          return {
            ...w,
            depth: newDepth,
            stability: newStability,
            consecutivePerfects: streak,
          };
        }
        return w;
      });

      // Calculate new global leverage
      const currentGlobalLeverage = updatedWedges.reduce(
        (sum, w) => sum + (w.isSeated ? (w.depth / 100) * w.maxCapContribution : 0),
        0
      );

      // Transition to Phase 3 Crowbar Extraction if global leverage >= 100%
      let nextPhase = prev.phase;
      let nextWedgeIndex = prev.activeWedgeIndex;

      if (currentGlobalLeverage >= 100) {
        nextPhase = 'crowbar-prying';
        soundEngine.playPowerup();
      } else if (newDepth >= 100) {
        // Active wedge reached max depth! Auto-advance to next undriven wedge (up to max 3 wedges)
        let candidateIdx = updatedWedges.findIndex((w) => w.depth < 100);
        if (candidateIdx !== -1) {
          nextWedgeIndex = candidateIdx;
          const targetW = updatedWedges[candidateIdx];
          nextPhase = targetW.isSeated ? 'hammering' : 'wedge-setting';
        } else {
          // All 3 wedges driven! Transition directly to Crowbar Extraction
          nextPhase = 'crowbar-prying';
          soundEngine.playPowerup();
        }
      }

      const isAdvancing = nextWedgeIndex !== prev.activeWedgeIndex;

      return {
        ...prev,
        phase: nextPhase,
        activeWedgeIndex: nextWedgeIndex,
        wedges: updatedWedges,
        globalLeverage: currentGlobalLeverage,
        yieldRemaining: newYield,
        cracks: newCracks,
        targetArcs: isAdvancing ? generateTargetArcs() : prev.targetArcs,
        settingStep: isAdvancing ? 0 : prev.settingStep,
        settingAccuracies: isAdvancing ? [] : prev.settingAccuracies,
        lastStrikeFeedback: {
          tier,
          text: isAdvancing
            ? `WEDGE #${activeW.id + 1} FULLY DRIVEN! ADVANCING TO WEDGE #${nextWedgeIndex + 1}`
            : `STRIKE: ${tier.toUpperCase()}! ${streak >= 2 ? `🔥 ${streak}X STREAK!` : ''}`,
          message: `Depth +${Math.round(depthGainPercent)}% | Leverage: ${Math.round(currentGlobalLeverage)}%`,
          time: Date.now(),
        },
      };
    });
  }, []);

  // Handler: Phase 3 Crowbar Pry
  const handleCrowbarPry = useCallback((userSide: 'left' | 'right') => {
    setSession((prev) => {
      if (prev.phase !== 'crowbar-prying') return prev;

      const pos = prev.crowbarPosition;
      const isMatchingSide =
        (userSide === 'left' && pos < 0) ||
        (userSide === 'right' && pos > 0);

      if (isMatchingSide) {
        // Perfect Apex hit condition: at the extreme outer ends (pos <= -75 for left, pos >= 75 for right)
        const isPerfectApex = (userSide === 'left' && pos <= -75) || (userSide === 'right' && pos >= 75);
        const progressGain = isPerfectApex ? 45 : 25;
        const newProgress = Math.min(100, prev.crowbarProgress + progressGain);

        soundEngine.playCrowbarPry(true);

        const tier: AccuracyTier = isPerfectApex ? 'perfect' : 'great';
        const text = isPerfectApex ? '⚡ PERFECT APEX PRY! (+45%)' : 'PRY SUCCESSFUL! (+25%)';
        const message = isPerfectApex
          ? 'Maximum mechanical leverage applied at peak angle!'
          : 'Rock fracture expanding...';

        if (newProgress >= 100) {
          soundEngine.playExtractionFanfare();

          // Generate extracted specimen specimen object
          const typeOptions: Specimen['type'][] = ['base-rock', 'ore-bearing', 'crystal-bearing', 'fossil-slab'];
          const chosenType = typeOptions[Math.floor(Math.random() * typeOptions.length)];

          const newSpecimen: Specimen = {
            id: `spec-${Date.now()}`,
            name:
              chosenType === 'crystal-bearing'
                ? `${prev.depositType.toUpperCase()} Flawless Gemstone`
                : chosenType === 'ore-bearing'
                ? `High-Grade ${prev.depositType === 'sandstone' ? 'Copper' : prev.depositType === 'granite' ? 'Iron' : 'Titanium'} Ore`
                : `${prev.depositType.toUpperCase()} Structured Slab`,
            type: chosenType,
            depositType: prev.depositType,
            quality: Math.round(prev.yieldRemaining),
            yieldAmount: Math.round(prev.yieldRemaining),
            weightKg: Math.round(10 + Math.random() * 20),
            value: Math.round(prev.yieldRemaining * 2.5 + Math.random() * 100),
            color: prev.depositType === 'sandstone' ? '#d97706' : prev.depositType === 'granite' ? '#64748b' : '#38bdf8',
            subMaterial: chosenType === 'crystal-bearing' ? 'Ruby Crystal' : 'Raw Ore Chunk',
            description: `Extracted cleanly from Work Area #${prev.workAreaIndex + 1} of the ${prev.depositType} wall seam.`,
            dateExtracted: new Date().toISOString(),
          };

          setShowSpecimenModal(true);

          return {
            ...prev,
            phase: 'specimen-extracted',
            crowbarProgress: 100,
            extractedSpecimen: newSpecimen,
            lastStrikeFeedback: {
              tier: 'perfect',
              text: 'ROCK SEAM DISLODGED!',
              message: 'Specimen extracted cleanly from seam!',
              time: Date.now(),
            },
          };
        }

        return {
          ...prev,
          crowbarProgress: newProgress,
          crowbarTargetSide: prev.crowbarTargetSide === 'left' ? 'right' : 'left',
          lastStrikeFeedback: {
            tier,
            text,
            message,
            time: Date.now(),
          },
        };
      } else {
        soundEngine.playCrowbarPry(false);
        return {
          ...prev,
          crowbarProgress: Math.max(0, prev.crowbarProgress - 12),
          lastStrikeFeedback: {
            tier: 'miss',
            text: 'MISSED PRY TIMING!',
            message: 'Wrong side or mistimed leverage (-12%)',
            time: Date.now(),
          },
        };
      }
    });
  }, []);

  // Handler: Right-click Reset Wedge at 50% stability loss
  const handleResetWedge = useCallback((wedgeIndex: number) => {
    setSession((prev) => {
      const targetWedge = prev.wedges[wedgeIndex];
      if (!targetWedge || targetWedge.stability > 50) return prev;

      soundEngine.playResetSound();

      const updatedWedges = prev.wedges.map((w, idx) => {
        if (idx === wedgeIndex) {
          return {
            ...w,
            stability: 100,
            depth: Math.max(0, w.depth - 15), // slight depth penalty for realignment
            isSeated: false,
          };
        }
        return w;
      });

      return {
        ...prev,
        phase: 'wedge-setting',
        activeWedgeIndex: wedgeIndex,
        wedges: updatedWedges,
        targetArcs: generateTargetArcs(),
        settingStep: 0,
        settingAccuracies: [],
        lastStrikeFeedback: {
          tier: 'good',
          text: 'RESET SUCCESSFUL!',
          message: 'Stability restored to 100%',
          time: Date.now(),
        },
      };
    });
  }, []);

  // Handler: Add Second / Third Wedge Pocket
  const handleAddWedge = useCallback(() => {
    setSession((prev) => {
      if (prev.wedges.length >= 4) return prev;

      const newId = prev.wedges.length;
      const newX = 35 + newId * 20;
      const newY = 48 + (newId % 2 === 0 ? -6 : 6);

      const newWedge = {
        id: newId,
        x: newX,
        y: newY,
        angle: 15,
        setQuality: 0,
        maxCapContribution: 50,
        depth: 0,
        stability: 100,
        isSeated: false,
        consecutivePerfects: 0,
      };

      return {
        ...prev,
        phase: 'wedge-setting',
        wedges: [...prev.wedges, newWedge],
        activeWedgeIndex: newId,
        targetArcs: generateTargetArcs(),
        settingStep: 0,
        settingAccuracies: [],
      };
    });
  }, []);

  // Handler: Switch Active Wedge
  const handleSelectWedge = useCallback((idx: number) => {
    setSession((prev) => {
      const targetW = prev.wedges[idx];
      if (!targetW) return prev;
      const isSeated = targetW.isSeated;
      return {
        ...prev,
        activeWedgeIndex: idx,
        phase: isSeated ? 'hammering' : 'wedge-setting',
        settingStep: 0,
        settingAccuracies: [],
      };
    });
  }, []);

  // Handler: Collect Extracted Specimen into Inventory
  const handleCollectSpecimen = () => {
    if (session.extractedSpecimen) {
      setInventory((prev) => ({
        ...prev,
        specimens: [session.extractedSpecimen!, ...prev.specimens],
      }));
      setSession((prev) => ({ ...prev, extractedSpecimen: null }));
      setShowSpecimenModal(false);
    }
  };

  // Handler: Advance to next work area along seam
  const handleNextWorkArea = () => {
    const nextIdx = session.workAreaIndex + 1;
    setSession(createInitialSession(session.depositType, nextIdx));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* Top Navbar */}
      <Navbar
        depositType={session.depositType}
        onSelectDeposit={handleSelectDeposit}
        settings={settings}
        onUpdateSettings={(newS) => setSettings((s) => ({ ...s, ...newS }))}
        onOpenWorkbench={() => setShowWorkbench(true)}
        onOpenInventory={() => setShowInventory(true)}
        onOpenGuide={() => setShowGuideModal(true)}
      />

      {/* Main Game Stage Layout */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 flex flex-col items-center justify-center space-y-4">
        {/* Interactive Rock Canvas */}
        <RockWallCanvas
          session={session}
          onTargetTap={handleTargetTap}
          onHammerStrike={handleHammerStrike}
          onCrowbarPry={handleCrowbarPry}
          onResetWedge={handleResetWedge}
          onSelectWedge={handleSelectWedge}
          onCollectSpecimen={handleCollectSpecimen}
          onNextWorkArea={handleNextWorkArea}
        />

        {/* Minimalist & Contextual Mining HUD */}
        <MiningHUD
          session={session}
          onSelectWedge={handleSelectWedge}
          onAddWedge={handleAddWedge}
          onResetActiveWedge={() => handleResetWedge(session.activeWedgeIndex)}
          onCrowbarPry={handleCrowbarPry}
        />
      </main>

      {/* Modals */}
      {showSpecimenModal && session.extractedSpecimen && (
        <SpecimenInspectModal
          specimen={session.extractedSpecimen}
          onClose={handleCollectSpecimen}
          onGoToWorkbench={() => {
            handleCollectSpecimen();
            setShowWorkbench(true);
          }}
        />
      )}

      {showWorkbench && (
        <Workbench
          inventory={inventory}
          hammer={hammer}
          onUpdateInventory={setInventory}
          onUpdateHammer={setHammer}
          onClose={() => setShowWorkbench(false)}
        />
      )}

      {showInventory && (
        <InventoryJournal inventory={inventory} onClose={() => setShowInventory(false)} />
      )}

      {showGuideModal && <GDDGuideModal onClose={() => setShowGuideModal(false)} />}
    </div>
  );
}
