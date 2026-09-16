export type DepositType = 'sandstone' | 'granite' | 'limestone';

export type MiningPhase = 
  | 'select-deposit'
  | 'wedge-setting'
  | 'hammering'
  | 'crowbar-prying'
  | 'specimen-extracted';

export type AccuracyTier = 'perfect' | 'great' | 'good' | 'okay' | 'bad' | 'horrible' | 'miss';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
}

export interface TargetArc {
  startAngle: number; // in degrees 0-360
  arcWidth: number;   // in degrees
  centerAngle: number;
}

export interface WedgeState {
  id: number;
  x: number; // percentage on wall (0-100)
  y: number; // percentage on wall (0-100)
  angle: number; // degrees
  setQuality: number; // 0 to 1
  maxCapContribution: number; // e.g. 70% for wedge 1, 50% for wedge 2
  depth: number; // 0 to 100
  stability: number; // 0 to 100
  isSeated: boolean;
  consecutivePerfects: number;
}

export interface CrackOverlay {
  id: string;
  type: 'main' | 'side';
  path: { x: number; y: number }[];
  width: number;
  opacity: number;
  color: string;
}

export type SpecimenType = 'base-rock' | 'ore-bearing' | 'crystal-bearing' | 'fossil-slab';

export interface Specimen {
  id: string;
  name: string;
  type: SpecimenType;
  depositType: DepositType;
  quality: number; // 0 to 100
  yieldAmount: number; // percentage of full potential
  weightKg: number;
  value: number;
  color: string;
  subMaterial?: string;
  description: string;
  dateExtracted: string;
}

export interface ProcessingInventory {
  specimens: Specimen[];
  crushedGravel: number;
  ores: Record<string, number>;
  ingots: Record<string, number>;
  rawCrystals: Record<string, number>;
  cutCrystals: Record<string, number>;
  gold: number;
}

export interface CrystalSocket {
  id: string;
  name: string;
  slotType: 'head' | 'pommel';
  installedCrystal: string | null;
  buffDescription: string;
}

export interface HammerUpgrade {
  headMaterial: 'Iron' | 'Bronze' | 'Steel' | 'Titanium' | 'Mithril';
  handleMaterial: 'Ash Wood' | 'Braided Leather' | 'Runed Oak' | 'Dragonhide';
  inlay: 'None' | 'Silver Filigree' | 'Gold Runes' | 'Celestial Etching';
  sockets: CrystalSocket[];
  appraisalValue: number;
}

export interface GameSettings {
  soundEnabled: boolean;
  musicEnabled: boolean;
  volume: number;
  particleDensity: 'low' | 'medium' | 'high';
}

export interface MiningSessionState {
  depositType: DepositType;
  hardnessRating: number;
  workAreaIndex: number;
  totalWorkAreas: number;
  phase: MiningPhase;
  wedges: WedgeState[];
  activeWedgeIndex: number;
  unlockedWedgeCount: number;
  targetArcs: TargetArc[];
  markerAngle: number;
  settingStep: number;
  settingAccuracies: number[];
  circleRadius: number;
  isCircleShrinking: boolean;
  crowbarProgress: number;
  crowbarTargetSide: 'left' | 'right';
  crowbarPosition: number;
  crowbarDirection: 1 | -1;
  crowbarConsecutiveMisses: number;
  globalLeverage: number;
  leverageCap: number;
  yieldRemaining: number;
  sideCrackCount: number;
  cracks: CrackOverlay[];
  lastStrikeFeedback: {
    tier: AccuracyTier;
    text: string;
    message: string;
    time: number;
  } | null;
  extractedSpecimen: Specimen | null;
}

export function isWedgeUnlocked(idx: number, session: MiningSessionState): boolean {
  if (idx <= 0) return true;
  if (idx === 1) {
    const w0 = session.wedges[0];
    return Boolean(
      (w0 && w0.depth >= 80) ||
      session.wedges[1]?.isSeated ||
      session.activeWedgeIndex >= 1 ||
      session.phase === 'crowbar-prying'
    );
  }
  if (idx === 2) {
    const w1 = session.wedges[1];
    return Boolean(
      (w1 && w1.depth >= 80) ||
      session.wedges[2]?.isSeated ||
      session.activeWedgeIndex >= 2 ||
      session.phase === 'crowbar-prying'
    );
  }
  return true;
}
