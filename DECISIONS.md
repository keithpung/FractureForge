# Project Architectural Decision Records (ADRs) & Game Design Log

**Project:** Rock Quarry — Realistic Mineral Extraction & Splitting Simulation  
**Repository Architecture:** React 18, TypeScript, Vite, Tailwind CSS, HTML5 2D Canvas Engine, Web Audio API  
**Last Updated:** 2026-09-16  

---

## 1. Project Overview & Gameplay Loop

The simulation models the ancient and modern quarrying craft of **plug-and-feather stone splitting**, progressing through four physical phases:

```
[Phase 1: Wedge Setting]  --->  [Phase 2: Heavy Hammering]  --->  [Phase 3: Crowbar Prying]  --->  [Phase 4: Extraction]
Rhythmic dial timing to         Compounding sledgehammer          Directional pry oscillation       Inspect, collect, and
seat wedges into boreholes      strikes driving fractures         to separate detached slab         catalog mineral specimen
```

---

## 2. Architectural Decision Records (ADRs)

### ADR-001: Four-Stage Mining State Engine
* **Status:** Accepted & Implemented
* **Context:** Needed a coherent game loop that models actual stonemasonry rather than an instantaneous click-to-break mechanic.
* **Decision:** Implemented `MiningSessionState` in `/src/App.tsx` containing:
  * `phase`: `'wedge-setting' | 'hammering' | 'crowbar-prying' | 'specimen-extracted'`
  * `wedges`: Array of independent wedge objects tracking penetration depth ($0 \to 100\%$), structural stability, seating quality, and crack contribution.
  * `leverage`: Calculated aggregate crack propagation ($0 \to 100\%$) across all seated wedges.
  * `specimen`: Procedurally rolled mineral or fossil specimen revealed upon slab separation.
* **Consequences:** Provides clear phase transitions, distinct player challenges per phase, and predictable state synchronization with the canvas renderer.

---

### ADR-002: Procedural Layered Rock Wall Canvas
* **Status:** Accepted & Implemented
* **Context:** The initial prototype used flat colors and abstract circles. The user requested realistic physical layers for the rock wall.
* **Decision:** Designed a procedural rock face shader in `/src/components/RockWallCanvas.tsx`:
  * Multi-frequency perlin-like noise passes for porous slate and granite texture.
  * Stratified sedimentary mineral banding with directional daylight shading.
  * Realistic drilled borehole sockets with stone dust rings and chamfered stone lips.
  * Dynamic fracture network where Bézier crack veins branch and widen between wedges as leverage increases.
* **Consequences:** Eliminates heavy external image asset downloads; runs at 60+ FPS while remaining dynamically responsive to canvas resizing and lighting effects.

---

### ADR-003: Physical Plug-and-Feather Wedge Assemblies
* **Status:** Accepted & Implemented
* **Context:** Abstract circular timing reticles lacked stonework immersion.
* **Decision:** Replaced abstract hitboxes with rendered 3D-styled **Plug-and-Feather Wedge Assemblies**:
  * **Borehole Socket:** Drilled stone cavity with depth shadow and stone dust collar.
  * **Feather Shims:** Two curved spring-steel guide plates flanking the central wedge.
  * **Central Wedge:** Polished, faceted high-carbon steel wedge that physically lowers into the borehole as `depth` increases.
  * **Striking Crown:** Mushroomed steel striking face that displays cumulative tool wear and metallic highlights.
* **Consequences:** Players can visually read wedge depth directly from the physical model rather than relying purely on numerical HUD indicators.

---

### ADR-004: Natural Sledgehammer Kinematics (Overhead Windup & Downward Swing)
* **Status:** Accepted & Implemented
* **Context:** User noted that previous rotational hammer animations "didn't feel natural" and requested that the hammer wind upward and swing downward upon clicking.
* **Decision:** Implemented realistic stonemason sledgehammer kinematics in `drawSledgehammer`:
  1. **Overhead Windup Stance:**
     * Hammer head hoists high above the wedge crown:
       $$\text{headY} = \text{targetY} - 72 - (\text{windupProgress} \times 32)$$
       $$\text{headX} = \text{targetX} + 16 + (\text{windupProgress} \times 18)$$
     * Cocking angle tilts upward-right from $48^\circ$ up to $74^\circ$.
     * Harmonic breathing idle sway:
       $$\text{breathe} = \sin(\text{time} \times 0.005) \times 2.5$$
  2. **Click Trigger & Downward Power Stroke ($0.0 \le p < 0.35$):**
     * Instantaneous response on mouse down or <kbd>Space</kbd>/<kbd>Enter</kbd>.
     * Cubic acceleration curve simulating gravity and muscular whip:
       $$\text{ease} = \left(\frac{p}{0.35}\right)^3$$
     * Downward motion blur velocity arcs sweeping along the hammer head's path.
     * Lands squarely on the wedge crown at $\text{impactAngle} = -5^\circ$.
  3. **Impact, Recoil, and Recovery ($0.35 \le p \le 1.0$):**
     * Stage 2 ($0.35 \le p < 0.60$): Elastic rebound bounce upward off the hard steel and rock:
       $$\text{recoil} = \sin\left(\frac{p - 0.35}{0.25} \times \pi\right) \times 32\text{px}$$
     * Stage 3 ($0.60 \le p \le 1.0$): Smooth sinusoidal recovery back to overhead ready stance.
* **Consequences:** Delivers visceral, physical weight to every strike, matching authentic stonemasonry footage.

---

### ADR-005: Visual Sledgehammer Integration into Wedge Setting
* **Status:** Accepted & Implemented
* **Context:** User requested: *"also add the hammer to the setting the wedge part"*.
* **Decision:**
  * Updated `drawWedgeSettingOverlay` in `/src/components/RockWallCanvas.tsx` to mount the sledgehammer overhead above the unseated borehole wedge.
  * Windup tension tracks the revolving hit marker's proximity to the green target arcs.
  * Player taps trigger rapid downward seating strikes, accompanied by stone dust bursts, bright metal sparks, and progressive wedge seating.
* **Consequences:** Unifies the tool experience across the entire game so the player always wields physical tools rather than looking at disconnected UI meters.

---

### ADR-006: Pure Web Audio API Synthesizer Engine
* **Status:** Accepted & Implemented
* **Context:** External sound samples cause network delay, missing audio states, or browser autoplay policy blocks.
* **Decision:** Implemented a zero-dependency procedural audio engine in `/src/utils/sound.ts`:
  * **Tool Strikes:** High-frequency bandpass-filtered square + sine wave combination with rapid decay ($0.06\text{s}$) for sharp metal-on-steel ringing.
  * **Rock Fracture Cracks:** Low-pass filtered pink noise burst modulated over $0.18\text{s}$ to produce stone crunching and subterranean shear.
  * **Crowbar Strains:** Dual-oscillator frequency-modulated saw waves simulating stressed metal leverage.
* **Consequences:** Zero asset download overhead; instantaneous sound trigger synchronized to the exact impact frame of the canvas render loop.

---

## 3. Codebase File Map

| File Path | Purpose |
|---|---|
| `/src/App.tsx` | Main application shell, `MiningSessionState` store, game loop orchestration, and modal handlers. |
| `/src/components/RockWallCanvas.tsx` | Primary 2D Canvas rendering engine: rock wall textures, wedge assemblies, sledgehammer kinematics, particle systems, and HUD. |
| `/src/types.ts` | Global TypeScript interfaces (`Wedge`, `MiningSessionState`, `MineralSpecimen`, `DepositType`). |
| `/src/utils/sound.ts` | Web Audio API procedural sound synthesizer for tool strikes, stone fracture crunches, and ambient audio. |
| `/src/data/deposits.ts` | Quarry deposit configurations (Slate, Granite, Sandstone, Basalt) and mineral rarity drop tables. |

---

## 4. Roadmap & ChatGPT Collaboration Prompts

When sharing this project or prompting ChatGPT for future additions, consider these immediate extension points:

1. **Deposit Upgrades & Shop Economy:**
   * *Prompt for ChatGPT:* *"Using `/src/types.ts` and `/src/App.tsx`, design an in-game quarry shop where players sell extracted specimens to purchase upgraded wedges (Titanium alloy, tungsten-carbide) and heavier sledgehammers (8lb, 12lb, 16lb) that boost strike damage and sweet spot window sizes."*
2. **Additional Geological Formations:**
   * *Prompt for ChatGPT:* *"Extend `RockWallCanvas.tsx` to support volcanic Obsidian and crystalline Geodes with custom fracture splintering, translucent crystal faces, and brittle failure mechanics."*
3. **Multi-Wedge Balancing Challenge:**
   * *Prompt for ChatGPT:* *"Implement asymmetric tension math in `App.tsx` where striking one wedge too far ahead of the others causes wedge binding or jagged fracture misalignment."*
