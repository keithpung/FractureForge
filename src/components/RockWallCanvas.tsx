import React, { useRef, useEffect, useState, useCallback } from 'react';
import { DepositType, MiningSessionState, Particle, isWedgeUnlocked } from '../types';
import { soundEngine } from '../utils/audio';

interface RockWallCanvasProps {
  session: MiningSessionState;
  onTargetTap: () => void;
  onHammerStrike: () => void;
  onCrowbarPry: (userSide: 'left' | 'right') => void;
  onResetWedge: (wedgeIndex: number) => void;
  onSelectWedge: (wedgeIndex: number) => void;
  onCollectSpecimen: () => void;
  onNextWorkArea: () => void;
}

export const RockWallCanvas: React.FC<RockWallCanvasProps> = ({
  session,
  onTargetTap,
  onHammerStrike,
  onCrowbarPry,
  onResetWedge,
  onSelectWedge,
  onCollectSpecimen,
  onNextWorkArea,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const shockwavesRef = useRef<Array<{ x: number; y: number; radius: number; maxRadius: number; alpha: number; color: string }>>([]);
  const floatingFeedbacksRef = useRef<Array<{ id: number; x: number; y: number; text: string; subText?: string; color: string; createdAt: number }>>([]);
  const strikeAnimRef = useRef<{ startTime: number; duration: number; tier: string } | null>(null);
  const shakeAmountRef = useRef<number>(0);
  const lastFeedbackTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  
  // Hover & UI states
  const [hoveredWedgeIndex, setHoveredWedgeIndex] = useState<number | null>(null);

  // Helper to spawn explosion / chip particles
  const spawnParticles = useCallback((x: number, y: number, color: string, count = 15) => {
    const newParticles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 5.5;
      newParticles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.5, // slight upward bounce
        size: 2 + Math.random() * 4,
        color,
        alpha: 1,
        life: 0,
        maxLife: 25 + Math.random() * 25,
      });
    }
    particlesRef.current.push(...newParticles);
  }, []);

  // Helper to spawn fast incandescent hot sparks from hammer strike
  const spawnSparks = useCallback((x: number, y: number, color: string, count = 20) => {
    const newSparks: Particle[] = [];
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI * 0.85 + Math.random() * Math.PI * 0.7; // fan upwards
      const speed = 2.5 + Math.random() * 7.0;
      newSparks.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 1.5 + Math.random() * 2.5,
        color: Math.random() > 0.35 ? color : '#ffffff',
        alpha: 1,
        life: 0,
        maxLife: 18 + Math.random() * 16,
      });
    }
    particlesRef.current.push(...newSparks);
  }, []);

  // Handle Canvas Click or Right-click
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Prevent default context menu on right clicks
    if (e.button === 2) {
      e.preventDefault();
    }
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) * (canvas.width / rect.width);
    const clickY = (e.clientY - rect.top) * (canvas.height / rect.height);
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;

    // Phase 3 Crowbar Prying mouse click handling
    if (session.phase === 'crowbar-prying') {
      if (e.button === 2) {
        // Right Mouse Button = Pry Right
        onCrowbarPry('right');
      } else {
        // Left Mouse Button = Pry Left (or check click side relative to center)
        const side = clickX < canvasWidth / 2 ? 'left' : 'right';
        onCrowbarPry(side);
      }
      return;
    }

    // Check if right click on an unstable wedge to reset
    if (e.button === 2) {
      session.wedges.forEach((w, idx) => {
        const wx = (w.x / 100) * canvasWidth;
        const wy = (w.y / 100) * canvasHeight;
        const dist = Math.hypot(clickX - wx, clickY - wy);
        if (dist < 35 && w.stability <= 50) {
          soundEngine.playResetSound();
          onResetWedge(idx);
        }
      });
      return;
    }

    // Check if clicked on any non-active wedge pin to select it
    let clickedWedgeIdx = -1;
    session.wedges.forEach((w, idx) => {
      if (!isWedgeUnlocked(idx, session)) return;
      const wx = (w.x / 100) * canvasWidth;
      const wy = (w.y / 100) * canvasHeight;
      const dist = Math.hypot(clickX - wx, clickY - wy);
      if (dist < 35) {
        clickedWedgeIdx = idx;
      }
    });

    if (clickedWedgeIdx !== -1 && clickedWedgeIdx !== session.activeWedgeIndex) {
      onSelectWedge(clickedWedgeIdx);
      return;
    }

    // Left clicks depending on current phase
    if (session.phase === 'wedge-setting') {
      const activeW = session.wedges[session.activeWedgeIndex];
      if (activeW) {
        strikeAnimRef.current = {
          startTime: performance.now(),
          duration: 260,
          tier: 'setting',
        };
        spawnParticles((activeW.x / 100) * canvasWidth, (activeW.y / 100) * canvasHeight - 24, '#fbbf24', 12);
      }
      onTargetTap();
    } else if (session.phase === 'hammering') {
      const activeW = session.wedges[session.activeWedgeIndex];
      if (activeW) {
        strikeAnimRef.current = {
          startTime: performance.now(),
          duration: 320,
          tier: session.circleRadius <= 25 ? 'perfect' : session.circleRadius <= 45 ? 'great' : 'okay',
        };
      }
      onHammerStrike();
    } else if (session.phase === 'specimen-extracted' && session.extractedSpecimen) {
      // Check if clicked extracted specimen on ground
      const groundY = canvasHeight * 0.82;
      const groundX = canvasWidth * 0.5;
      const dist = Math.hypot(clickX - groundX, clickY - groundY);
      if (dist < 60) {
        onCollectSpecimen();
      }
    }
  };

  // Keyboard controls for precision timing (SPACE or Enter to strike/tap, Left/Right or A/D to pry, Tab/N to switch wedge)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        if (session.phase === 'wedge-setting') {
          const activeW = session.wedges[session.activeWedgeIndex];
          if (activeW) {
            strikeAnimRef.current = {
              startTime: performance.now(),
              duration: 260,
              tier: 'setting',
            };
          }
          onTargetTap();
        } else if (session.phase === 'hammering') {
          strikeAnimRef.current = {
            startTime: performance.now(),
            duration: 320,
            tier: session.circleRadius <= 25 ? 'perfect' : session.circleRadius <= 45 ? 'great' : 'okay',
          };
          onHammerStrike();
        }
      } else if ((e.code === 'ArrowLeft' || e.code === 'KeyA') && session.phase === 'crowbar-prying') {
        onCrowbarPry('left');
      } else if ((e.code === 'ArrowRight' || e.code === 'KeyD') && session.phase === 'crowbar-prying') {
        onCrowbarPry('right');
      } else if (e.code === 'Tab' || e.code === 'KeyN') {
        e.preventDefault();
        if (session.wedges.length > 1) {
          const nextIdx = (session.activeWedgeIndex + 1) % session.wedges.length;
          onSelectWedge(nextIdx);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [session.phase, session.activeWedgeIndex, session.wedges.length, session.circleRadius, onTargetTap, onHammerStrike, onCrowbarPry, onSelectWedge]);

  // Main Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frameCount = 0;

    const render = () => {
      frameCount++;
      const width = canvas.width;
      const height = canvas.height;

      // Handle strike feedback change from HUD or keyboard
      if (session.lastStrikeFeedback && session.lastStrikeFeedback.time !== lastFeedbackTimeRef.current) {
        lastFeedbackTimeRef.current = session.lastStrikeFeedback.time;
        const activeW = session.wedges[session.activeWedgeIndex];
        if (activeW) {
          const wx = (activeW.x / 100) * width;
          const wy = (activeW.y / 100) * height;
          const tier = session.lastStrikeFeedback.tier;

          if (!strikeAnimRef.current || performance.now() - strikeAnimRef.current.startTime > 120) {
            strikeAnimRef.current = {
              startTime: performance.now(),
              duration: 320,
              tier,
            };
          }

          shakeAmountRef.current = tier === 'perfect' ? 8 : tier === 'great' ? 6 : tier === 'good' ? 4 : 2;

          shockwavesRef.current.push({
            x: wx,
            y: wy - 18,
            radius: 8,
            maxRadius: 44,
            alpha: 0.9,
            color: tier === 'perfect' ? '#38bdf8' : tier === 'great' ? '#4ade80' : '#fbbf24',
          });

          spawnSparks(wx, wy - 16, tier === 'perfect' ? '#67e8f9' : '#fbbf24', tier === 'perfect' ? 24 : 16);
          spawnParticles(wx, wy - 12, '#64748b', 12);

          floatingFeedbacksRef.current.push({
            id: Date.now() + Math.random(),
            x: wx,
            y: wy - 42,
            text: session.lastStrikeFeedback.text,
            subText: session.lastStrikeFeedback.message,
            color: tier === 'perfect' ? '#4ade80' : tier === 'great' ? '#38bdf8' : tier === 'good' ? '#fbbf24' : '#f87171',
            createdAt: performance.now(),
          });
        }
      }

      // Calculate camera shake
      let shakeX = 0;
      let shakeY = 0;
      if (shakeAmountRef.current > 0.1) {
        shakeX = (Math.random() - 0.5) * shakeAmountRef.current;
        shakeY = (Math.random() - 0.5) * shakeAmountRef.current;
        shakeAmountRef.current *= 0.82;
      }

      ctx.save();
      ctx.translate(shakeX, shakeY);

      ctx.clearRect(0, 0, width, height);

      // --- 1. Draw Rock Wall Surface Background ---
      drawRockTexture(ctx, width, height, session.depositType, session.phase === 'specimen-extracted');

      // --- 2. Draw Side Cracks & Main Cracks ---
      drawCracks(ctx, width, height, session);

      // Calculate jolt compression offset on the active wedge from hammer impact
      let currentJolt = 0;
      if (strikeAnimRef.current) {
        const elapsed = performance.now() - strikeAnimRef.current.startTime;
        const p = elapsed / strikeAnimRef.current.duration;
        if (p >= 0.28 && p <= 0.65) {
          const joltNorm = Math.sin(((p - 0.28) / (0.65 - 0.28)) * Math.PI);
          currentJolt = joltNorm * 5.0; // 5px physical downward depression
        }
      }

      // --- 4. Draw Wedges Assembly (Borehole + Feathers + Plug Wedge) ---
      session.wedges.forEach((wedge, idx) => {
        if (!isWedgeUnlocked(idx, session)) return;

        const isCurrentActive = idx === session.activeWedgeIndex;
        const jolt = isCurrentActive ? currentJolt : 0;

        if (!wedge.isSeated && idx !== session.activeWedgeIndex) {
          drawUpcomingWedgeTarget(ctx, width, height, wedge, idx);
        } else {
          drawWedgeAssembly(
            ctx,
            width,
            height,
            wedge,
            isCurrentActive,
            idx === hoveredWedgeIndex,
            session.phase,
            jolt
          );
        }
      });

      // --- 5. Phase Specific Visual Overlays ---
      if (session.phase === 'wedge-setting') {
        drawWedgeSettingOverlay(ctx, width, height, session, strikeAnimRef.current);
      } else if (session.phase === 'hammering') {
        drawHammeringOverlay(ctx, width, height, session, strikeAnimRef.current);
      } else if (session.phase === 'crowbar-prying') {
        drawCrowbarOverlay(ctx, width, height, session);
      } else if (session.phase === 'specimen-extracted' && session.extractedSpecimen) {
        drawSpecimenOnGround(ctx, width, height, session.extractedSpecimen, frameCount);
      }

      // --- 6. Draw Expanding Shockwaves ---
      ctx.save();
      shockwavesRef.current.forEach((sw) => {
        sw.radius += 2.2;
        sw.alpha *= 0.88;
        if (sw.alpha > 0.02) {
          ctx.strokeStyle = sw.color;
          ctx.lineWidth = Math.max(1, (1 - sw.radius / sw.maxRadius) * 4);
          ctx.globalAlpha = sw.alpha;
          ctx.beginPath();
          ctx.ellipse(sw.x, sw.y, sw.radius, sw.radius * 0.7, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      });
      shockwavesRef.current = shockwavesRef.current.filter((sw) => sw.alpha > 0.02 && sw.radius < sw.maxRadius);
      ctx.restore();

      // --- 7. Draw Floating Combat Text Feedback ---
      const now = performance.now();
      ctx.save();
      floatingFeedbacksRef.current.forEach((fb) => {
        const age = now - fb.createdAt;
        if (age < 900) {
          const progress = age / 900;
          const curY = fb.y - progress * 28;
          const alpha = 1 - Math.pow(progress, 2);
          ctx.globalAlpha = alpha;
          ctx.textAlign = 'center';
          ctx.shadowColor = '#000000';
          ctx.shadowBlur = 6;
          ctx.fillStyle = fb.color;
          ctx.font = '900 13px sans-serif';
          ctx.fillText(fb.text, fb.x, curY);
          if (fb.subText) {
            ctx.fillStyle = '#f8fafc';
            ctx.font = 'bold 10px sans-serif';
            ctx.fillText(fb.subText, fb.x, curY + 13);
          }
        }
      });
      floatingFeedbacksRef.current = floatingFeedbacksRef.current.filter((fb) => now - fb.createdAt < 900);
      ctx.restore();

      // --- 8. Update and Draw Particles ---
      ctx.save();
      particlesRef.current.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15; // gravity
        p.life++;
        p.alpha = 1 - p.life / p.maxLife;

        if (p.alpha > 0) {
          ctx.fillStyle = p.color;
          ctx.globalAlpha = Math.max(0, p.alpha);
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      });
      particlesRef.current = particlesRef.current.filter((p) => p.life < p.maxLife);
      ctx.restore();

      // Restore camera shake offset
      ctx.restore();

      // --- 9. Draw Video-Style Top Right HUD Gauge (Static Screen Space) ---
      drawVideoHUD(ctx, width, height, session);

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [session, hoveredWedgeIndex, spawnSparks, spawnParticles]);

  return (
    <div className="relative w-full aspect-[16/9] bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl select-none group">
      <canvas
        ref={canvasRef}
        width={960}
        height={540}
        onMouseDown={handleCanvasMouseDown}
        onContextMenu={(e) => e.preventDefault()}
        onMouseMove={(e) => {
          const canvas = canvasRef.current;
          if (!canvas) return;
          const rect = canvas.getBoundingClientRect();
          const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
          const my = (e.clientY - rect.top) * (canvas.height / rect.height);

          let hovered = null;
          session.wedges.forEach((w, idx) => {
            if (!isWedgeUnlocked(idx, session)) return;
            const wx = (w.x / 100) * canvas.width;
            const wy = (w.y / 100) * canvas.height;
            if (Math.hypot(mx - wx, my - wy) < 30) {
              hovered = idx;
            }
          });
          setHoveredWedgeIndex(hovered);
        }}
        className="w-full h-full object-cover cursor-crosshair"
      />

      {/* Floating Guidance Banner */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-md px-4 py-1.5 rounded-full border border-slate-700/80 shadow-lg text-xs font-semibold text-slate-200 flex items-center gap-2 pointer-events-none">
        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
        {session.phase === 'wedge-setting' && 'PHASE 1: TAP TARGET ARCS TO SEAT WEDGE'}
        {session.phase === 'hammering' && 'PHASE 2: STRIKE WHEN CIRCLE MATCHES WEDGE HEAD'}
        {session.phase === 'crowbar-prying' && 'PHASE 3: PRY ROCK LOOSE WITH ALTERNATING TIMING'}
        {session.phase === 'specimen-extracted' && 'EXTRACTION COMPLETE: CLICK SPECIMEN TO COLLECT'}
      </div>

      {/* Reset Tooltip when hover unstable wedge */}
      {hoveredWedgeIndex !== null && session.wedges[hoveredWedgeIndex]?.stability <= 50 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-rose-950/90 text-rose-200 border border-rose-500/50 px-3 py-1.5 rounded-lg text-xs font-semibold animate-bounce shadow-xl pointer-events-none">
          ⚠️ Right-Click to Reset Wedge & Restore Alignment!
        </div>
      )}

      {/* Next Work Area / Repeat Button on Specimen Extracted */}
      {session.phase === 'specimen-extracted' && !session.extractedSpecimen && (
        <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm flex flex-col items-center justify-center gap-4 text-center p-6 animate-fade-in">
          <div className="text-2xl font-black text-amber-400 tracking-wide uppercase">
            Work Area #{session.workAreaIndex + 1} Cleared!
          </div>
          <p className="text-xs text-slate-300 max-w-md">
            The fracture line has extended deeper into the {session.depositType} wall seam. Prepare for the next extraction section!
          </p>
          <button
            onClick={onNextWorkArea}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-emerald-500 text-slate-950 font-black text-sm uppercase tracking-wider shadow-lg hover:scale-105 transition cursor-pointer"
          >
            Advance to Next Seam Section →
          </button>
        </div>
      )}
    </div>
  );
};

// ==========================================
// CANVAS DRAWING HELPERS
// ==========================================

function drawEmbeddedDiamond(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  ctx.translate(x, y);

  // Soft glow around translucent crystal
  ctx.fillStyle = 'rgba(186, 230, 253, 0.25)';
  ctx.beginPath();
  ctx.arc(0, 0, 24, 0, Math.PI * 2);
  ctx.fill();

  // Faceted crystal polygon shape (matching video diamond at 00:00)
  const points = [
    { x: 0, y: -16 },
    { x: 14, y: -6 },
    { x: 10, y: 14 },
    { x: -10, y: 14 },
    { x: -14, y: -6 },
  ];

  ctx.fillStyle = 'rgba(224, 242, 254, 0.85)';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Inner facet reflection lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
  ctx.beginPath();
  ctx.moveTo(0, -16);
  ctx.lineTo(0, 14);
  ctx.moveTo(-14, -6);
  ctx.lineTo(14, -6);
  ctx.stroke();

  // Specular sparkle highlight
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(-4, -8, 2.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawVideoHUD(ctx: CanvasRenderingContext2D, width: number, height: number, session: MiningSessionState) {
  const boxWidth = 145;
  const boxHeight = 95;
  const bx = width - boxWidth - 15;
  const by = 15;

  ctx.save();
  ctx.translate(bx, by);

  // Outer dark metal panel
  ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
  ctx.strokeStyle = '#b45309'; // Gold trim border
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(0, 0, boxWidth, boxHeight, 6);
  ctx.fill();
  ctx.stroke();

  // Corner rivets
  ctx.fillStyle = '#64748b';
  [[4, 4], [boxWidth - 4, 4], [4, boxHeight - 4], [boxWidth - 4, boxHeight - 4]].forEach(([rx, ry]) => {
    ctx.beginPath();
    ctx.arc(rx, ry, 2, 0, Math.PI * 2);
    ctx.fill();
  });

  // Top Title: Leverage
  ctx.fillStyle = '#f59e0b';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Leverage', boxWidth / 2, 16);

  // Horizontal Segmented Leverage Bar
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(12, 22, boxWidth - 24, 12);
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 1;
  ctx.strokeRect(12, 22, boxWidth - 24, 12);

  const leveragePercent = Math.min(1, session.globalLeverage / 100);
  const barWidth = (boxWidth - 24) * leveragePercent;
  ctx.fillStyle = '#fbbf24';
  ctx.fillRect(12, 22, barWidth, 12);

  // Vertical Meters Section: Depth & Stability
  const activeW = session.wedges[session.activeWedgeIndex] || session.wedges[0];
  const depthRatio = activeW ? activeW.depth / 100 : 0;
  const stabilityRatio = activeW ? activeW.stability / 100 : 1;

  // Depth Vertical Bar (Left)
  ctx.fillStyle = '#cbd5e1';
  ctx.font = '9px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Depth', 38, 46);

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(30, 50, 16, 36);
  ctx.strokeStyle = '#475569';
  ctx.strokeRect(30, 50, 16, 36);

  ctx.fillStyle = '#22c55e';
  ctx.fillRect(30, 50 + (1 - depthRatio) * 36, 16, depthRatio * 36);

  // Stability Vertical Bar (Right)
  ctx.fillStyle = '#cbd5e1';
  ctx.font = '9px sans-serif';
  ctx.fillText('Stability', boxWidth - 38, 46);

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(boxWidth - 46, 50, 16, 36);
  ctx.strokeStyle = '#475569';
  ctx.strokeRect(boxWidth - 46, 50, 16, 36);

  const stabGrad = ctx.createLinearGradient(0, 50, 0, 86);
  stabGrad.addColorStop(0, '#22c55e');
  stabGrad.addColorStop(1, '#ef4444');
  ctx.fillStyle = stabGrad;
  ctx.fillRect(boxWidth - 46, 50 + (1 - stabilityRatio) * 36, 16, stabilityRatio * 36);

  ctx.restore();
}

// Texture cache for high-performance realistic rock wall background
const textureCache = new Map<string, HTMLCanvasElement>();

function getOrCreateRockWallTexture(width: number, height: number, type: DepositType): HTMLCanvasElement {
  const cacheKey = `${Math.round(width)}x${Math.round(height)}_${type}`;
  if (textureCache.has(cacheKey)) {
    return textureCache.get(cacheKey)!;
  }

  const offscreen = document.createElement('canvas');
  offscreen.width = width;
  offscreen.height = height;
  const ctx = offscreen.getContext('2d');
  if (!ctx) return offscreen;

  // --- 1. Base Natural Stone Color Palette ---
  // Default (Limestone/Slate): Realistic deep grey-brown chiseled stone
  let palette = {
    baseBg: '#2d333b',
    gradientStops: ['#4b535e', '#3a414b', '#2e343d', '#22272e', '#191d24'],
    slabHighlights: ['rgba(235, 238, 245, 0.35)', 'rgba(210, 215, 225, 0.25)'],
    slabShadows: ['rgba(12, 14, 18, 0.75)', 'rgba(5, 6, 8, 0.85)'],
    veinColor: 'rgba(212, 212, 216, 0.2)',
  };

  if (type === 'sandstone') {
    palette = {
      baseBg: '#451a03',
      gradientStops: ['#b45309', '#92400e', '#78350f', '#581c0c', '#3c1208'],
      slabHighlights: ['rgba(254, 215, 170, 0.35)', 'rgba(251, 146, 60, 0.25)'],
      slabShadows: ['rgba(30, 10, 5, 0.75)', 'rgba(15, 5, 2, 0.85)'],
      veinColor: 'rgba(253, 230, 138, 0.25)',
    };
  } else if (type === 'granite') {
    palette = {
      baseBg: '#1e293b',
      gradientStops: ['#64748b', '#475569', '#334155', '#1e293b', '#0f172a'],
      slabHighlights: ['rgba(241, 245, 249, 0.35)', 'rgba(203, 213, 225, 0.25)'],
      slabShadows: ['rgba(15, 23, 42, 0.75)', 'rgba(2, 6, 23, 0.85)'],
      veinColor: 'rgba(255, 255, 255, 0.2)',
    };
  }

  // Draw Base Gradient
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  palette.gradientStops.forEach((color, idx) => {
    bgGrad.addColorStop(idx / (palette.gradientStops.length - 1), color);
  });
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // --- 2. Organic Chiseled Stone Slabs (Overlapping natural rock strata) ---
  // Seeded deterministic pseudo-random helper
  let seed = 42;
  const pseudoRand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  const numSlabs = 28;
  for (let i = 0; i < numSlabs; i++) {
    const cx = pseudoRand() * width;
    const cy = pseudoRand() * height;
    const rx = 60 + pseudoRand() * 120;
    const ry = 40 + pseudoRand() * 90;
    const pointsCount = 7 + Math.floor(pseudoRand() * 4);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((pseudoRand() - 0.5) * 0.8);

    // Build organic jagged polygon shape
    ctx.beginPath();
    for (let p = 0; p < pointsCount; p++) {
      const angle = (p / pointsCount) * Math.PI * 2;
      const distVar = 0.75 + pseudoRand() * 0.5;
      const px = Math.cos(angle) * rx * distVar;
      const py = Math.sin(angle) * ry * distVar;
      if (p === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();

    // Fill with directional lit stone gradient (-45deg light direction)
    const slabGrad = ctx.createLinearGradient(-rx, -ry, rx, ry);
    const baseColor = palette.gradientStops[Math.floor(pseudoRand() * palette.gradientStops.length)];
    slabGrad.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
    slabGrad.addColorStop(0.3, baseColor);
    slabGrad.addColorStop(1, 'rgba(0, 0, 0, 0.45)');

    ctx.fillStyle = slabGrad;
    ctx.fill();

    // Draw Chiseled Top/Left Highlight Rim
    ctx.strokeStyle = palette.slabHighlights[i % palette.slabHighlights.length];
    ctx.lineWidth = 1.5 + pseudoRand() * 1.5;
    ctx.stroke();

    // Draw Bottom/Right Deep Cut Crevices
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 8;
    ctx.strokeStyle = palette.slabShadows[i % palette.slabShadows.length];
    ctx.lineWidth = 2.5 + pseudoRand() * 2;
    ctx.stroke();

    ctx.restore();
  }

  // --- 3. Organic Natural Mineral Veins ---
  ctx.save();
  for (let v = 0; v < 3; v++) {
    const startX = pseudoRand() * width;
    const startY = 0;
    ctx.strokeStyle = palette.veinColor;
    ctx.lineWidth = 2 + pseudoRand() * 3;
    ctx.lineCap = 'round';

    ctx.beginPath();
    let curX = startX;
    let curY = startY;
    ctx.moveTo(curX, curY);

    while (curY < height) {
      curX += (pseudoRand() - 0.5) * 40;
      curY += 20 + pseudoRand() * 30;
      ctx.lineTo(curX, curY);
    }
    ctx.stroke();
  }
  ctx.restore();

  // --- 4. Micro-Chiseled Stone Grain & Pits (Hundreds of tactile stone dots) ---
  ctx.save();
  for (let p = 0; p < 900; p++) {
    const px = pseudoRand() * width;
    const py = pseudoRand() * height;
    const sz = 1 + pseudoRand() * 2.5;

    // Dark micro-pit
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillRect(px, py, sz, sz);

    // Specular highlight dot next to it
    if (pseudoRand() > 0.6) {
      ctx.fillStyle = 'rgba(255, 255, 250, 0.45)';
      ctx.fillRect(px - 1, py - 1, sz * 0.8, sz * 0.8);
    }
  }
  ctx.restore();

  // --- 5. Natural Dark Stone Fissure Network ---
  ctx.save();
  ctx.strokeStyle = 'rgba(10, 12, 16, 0.7)';
  ctx.lineWidth = 1.8;
  for (let f = 0; f < 5; f++) {
    let fx = pseudoRand() * width;
    let fy = pseudoRand() * height;
    ctx.beginPath();
    ctx.moveTo(fx, fy);
    for (let seg = 0; seg < 6; seg++) {
      fx += (pseudoRand() - 0.5) * 60;
      fy += (pseudoRand() - 0.5) * 60;
      ctx.lineTo(fx, fy);
    }
    ctx.stroke();
  }
  ctx.restore();

  // --- 6. Directional Lighting & Atmospheric Vignette ---
  // Top-left soft ambient light source
  const ambientLight = ctx.createRadialGradient(width * 0.2, height * 0.15, 50, width * 0.2, height * 0.15, width * 0.9);
  ambientLight.addColorStop(0, 'rgba(255, 255, 245, 0.18)');
  ambientLight.addColorStop(0.5, 'rgba(255, 255, 245, 0.05)');
  ambientLight.addColorStop(1, 'rgba(0, 0, 0, 0.35)');
  ctx.fillStyle = ambientLight;
  ctx.fillRect(0, 0, width, height);

  // Outer Edge Vignette
  const vignette = ctx.createRadialGradient(width * 0.5, height * 0.5, width * 0.3, width * 0.5, height * 0.5, width * 0.75);
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignette.addColorStop(0.7, 'rgba(0, 0, 0, 0.25)');
  vignette.addColorStop(1, 'rgba(0, 0, 0, 0.65)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);

  textureCache.set(cacheKey, offscreen);
  return offscreen;
}

function drawRockTexture(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  type: DepositType,
  isExtracted: boolean
) {
  // Render photorealistic cached background texture
  const bgCanvas = getOrCreateRockWallTexture(width, height, type);
  ctx.drawImage(bgCanvas, 0, 0);

  // Embedded Faceted Diamond Gemstone positioned INSIDE the wedge fracture triangle
  drawEmbeddedDiamond(ctx, width * 0.48, height * 0.43);

  // Draw excavated cavity if extracted
  if (isExtracted) {
    ctx.save();
    // Deep dark 3D crater hole in rock wall
    const holeGrad = ctx.createRadialGradient(width * 0.5, height * 0.45, 10, width * 0.5, height * 0.45, width * 0.2);
    holeGrad.addColorStop(0, '#020617');
    holeGrad.addColorStop(0.7, '#0f172a');
    holeGrad.addColorStop(1, '#334155');
    ctx.fillStyle = holeGrad;

    ctx.beginPath();
    ctx.ellipse(width * 0.5, height * 0.45, width * 0.2, height * 0.16, 0.1, 0, Math.PI * 2);
    ctx.fill();

    // Fractured rock edge highlight
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  }
}


function drawSeamPath(ctx: CanvasRenderingContext2D, width: number, height: number, type: DepositType) {
  ctx.save();
  ctx.strokeStyle = type === 'sandstone' ? '#f59e0b' : type === 'granite' ? '#cbd5e1' : '#94a3b8';
  ctx.lineWidth = 3;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.moveTo(width * 0.15, height * 0.52);
  ctx.quadraticCurveTo(width * 0.5, height * 0.38, width * 0.85, height * 0.55);
  ctx.stroke();
  ctx.restore();
}

function drawJaggedLine(
  ctx: CanvasRenderingContext2D,
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  offsets: number[],
  scale: number
) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const dist = Math.hypot(dx, dy) || 1;
  const nx = -dy / dist;
  const ny = dx / dist;

  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  const count = offsets.length;
  for (let i = 0; i < count; i++) {
    const t = (i + 1) / (count + 1);
    const mx = p1.x + dx * t + nx * offsets[i] * scale;
    const my = p1.y + dy * t + ny * offsets[i] * scale;
    ctx.lineTo(mx, my);
  }
  ctx.lineTo(p2.x, p2.y);
  ctx.stroke();
}

function drawCracks(ctx: CanvasRenderingContext2D, width: number, height: number, session: MiningSessionState) {
  ctx.save();
  
  // 1. Draw user side-cracks & micro-splinters (Miss hit fractures)
  session.cracks.forEach((crack) => {
    if (crack.path.length < 2) return;

    // Pass A: Deep black fissure shadow beneath crack
    ctx.save();
    ctx.strokeStyle = '#020617';
    ctx.lineWidth = crack.width + 3.5;
    ctx.globalAlpha = 0.95;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo((crack.path[0].x / 100) * width, (crack.path[0].y / 100) * height);
    for (let i = 1; i < crack.path.length; i++) {
      ctx.lineTo((crack.path[i].x / 100) * width, (crack.path[i].y / 100) * height);
    }
    ctx.stroke();
    ctx.restore();

    // Pass B: Intense red fracture core representing rock stress damage
    ctx.save();
    ctx.strokeStyle = crack.color || '#dc2626';
    ctx.lineWidth = crack.width;
    ctx.globalAlpha = crack.opacity;
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo((crack.path[0].x / 100) * width, (crack.path[0].y / 100) * height);
    for (let i = 1; i < crack.path.length; i++) {
      ctx.lineTo((crack.path[i].x / 100) * width, (crack.path[i].y / 100) * height);
    }
    ctx.stroke();
    ctx.restore();

    // Pass C: Crisp light-colored rock edge highlight for 3D depth
    ctx.save();
    ctx.strokeStyle = '#fca5a5';
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.65;
    ctx.beginPath();
    ctx.moveTo((crack.path[0].x / 100) * width + 1, (crack.path[0].y / 100) * height - 1);
    for (let i = 1; i < crack.path.length; i++) {
      ctx.lineTo((crack.path[i].x / 100) * width + 1, (crack.path[i].y / 100) * height - 1);
    }
    ctx.stroke();
    ctx.restore();

    // Pass D: Branching side splinters radiating at joints to show shattering
    ctx.save();
    ctx.strokeStyle = '#b91c1c';
    ctx.lineWidth = Math.max(1, crack.width * 0.5);
    ctx.globalAlpha = 0.8;
    for (let i = 1; i < crack.path.length - 1; i++) {
      const px = (crack.path[i].x / 100) * width;
      const py = (crack.path[i].y / 100) * height;
      const dx = crack.path[i + 1].x - crack.path[i - 1].x;
      const dy = crack.path[i + 1].y - crack.path[i - 1].y;
      const branchLen = 8 + (i % 3) * 6;
      const perpX = -dy;
      const perpY = dx;
      const norm = Math.hypot(perpX, perpY) || 1;

      ctx.beginPath();
      ctx.moveTo(px, py);
      const dir = i % 2 === 0 ? 1 : -1;
      ctx.lineTo(px + (perpX / norm) * branchLen * dir, py + (perpY / norm) * branchLen * dir);
      ctx.stroke();
    }
    ctx.restore();
  });

  // 2. Dynamic 3-Way Triangular Jagged Fracture Lines connecting W1 (28,55), W2 (68,52), W3 (48,28), and Pry Spot (48,72)
  const w1 = session.wedges[0];
  const w2 = session.wedges[1];
  const w3 = session.wedges[2];

  const w1pt = { x: ((w1 ? w1.x : 28) / 100) * width, y: ((w1 ? w1.y : 55) / 100) * height };
  const w2pt = { x: ((w2 ? w2.x : 68) / 100) * width, y: ((w2 ? w2.y : 52) / 100) * height };
  const w3pt = { x: ((w3 ? w3.x : 48) / 100) * width, y: ((w3 ? w3.y : 28) / 100) * height };

  // Pry Spot placed directly ON the main seam line between Wedge 1 (28,55) and Wedge 2 (68,52)
  const pryPt = {
    x: (w1pt.x + w2pt.x) / 2,
    y: (w1pt.y + w2pt.y) / 2,
  };

  // Jagged offset patterns for realistic natural rock fractures
  const offsets1 = [3.5, -4.2, 5.0, -2.8, 4.1];
  const offsets2 = [-4.0, 3.8, -5.2, 2.5, -3.9];
  const offsets3 = [3.2, -5.5, 4.0, -3.2, 2.8];
  const offsetsOpp1 = [-3.2, 4.1, -2.8];
  const offsetsOpp2 = [3.8, -4.2, 3.1];
  const offsetsOpp3 = [-3.5, 3.9, -2.7];

  // Helper for dual-pass hybrid crack rendering (outer dark fissure + inner crisp highlight)
  const renderHybridFracture = (
    pA: { x: number; y: number },
    pB: { x: number; y: number },
    offs: number[],
    depth: number,
    scale: number
  ) => {
    // Pass A: Wide dark void fissure shadow
    ctx.strokeStyle = '#020617';
    ctx.lineWidth = 3 + depth * 5;
    ctx.globalAlpha = 0.8 + depth * 0.2;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 6;
    drawJaggedLine(ctx, pA, pB, offs, scale);

    // Pass B: Inner dark core crack line
    ctx.strokeStyle = depth > 0.5 ? '#090d16' : '#1e293b';
    ctx.lineWidth = 1.5 + depth * 2.5;
    ctx.globalAlpha = 1.0;
    ctx.shadowBlur = 0;
    drawJaggedLine(ctx, pA, pB, offs, scale);

    // Pass C: Crisp top rock highlight edge for 3D depth effect (Overlay Art)
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.35 + depth * 0.35;
    drawJaggedLine(
      ctx,
      { x: pA.x + 1, y: pA.y - 1 },
      { x: pB.x + 1, y: pB.y - 1 },
      offs,
      scale
    );
  };

  // Line 1: Main Horizontal Seam (W1 -> W2 propagating as W1 is driven in)
  if (w1 && (w1.depth > 0 || session.phase === 'crowbar-prying')) {
    const f1 = session.phase === 'crowbar-prying' ? 1.2 : Math.min(1.2, (w1.depth / 100) * 1.2);
    const p1End = {
      x: w1pt.x + (w2pt.x - w1pt.x) * f1,
      y: w1pt.y + (w2pt.y - w1pt.y) * f1,
    };
    const depth1 = Math.min(1, Math.max(0.15, w1.depth / 100));
    renderHybridFracture(w1pt, p1End, offsets1, depth1, 1.2);

    // Opposite crack growing ~20% backwards behind Wedge 1
    const backF1 = (w1.depth / 100) * 0.20;
    const p1Back = {
      x: w1pt.x - (w2pt.x - w1pt.x) * backF1,
      y: w1pt.y - (w2pt.y - w1pt.y) * backF1,
    };
    renderHybridFracture(w1pt, p1Back, offsetsOpp1, depth1, 0.9);
  }

  // Line 2: Intersecting Seam (W2 -> W3 propagating as W2 is driven in)
  if (w2 && (w2.depth > 0 || session.phase === 'crowbar-prying')) {
    const f2 = session.phase === 'crowbar-prying' ? 1.2 : Math.min(1.2, (w2.depth / 100) * 1.2);
    const p2End = {
      x: w2pt.x + (w3pt.x - w2pt.x) * f2,
      y: w2pt.y + (w3pt.y - w2pt.y) * f2,
    };
    const depth2 = Math.min(1, Math.max(0.15, w2.depth / 100));
    renderHybridFracture(w2pt, p2End, offsets2, depth2, 1.2);

    // Opposite crack growing ~20% backwards behind Wedge 2
    const backF2 = (w2.depth / 100) * 0.20;
    const p2Back = {
      x: w2pt.x - (w3pt.x - w2pt.x) * backF2,
      y: w2pt.y - (w3pt.y - w2pt.y) * backF2,
    };
    renderHybridFracture(w2pt, p2Back, offsetsOpp2, depth2, 0.9);
  }

  // Line 3: Closing Seam Line (W3 -> W1 propagating as W3 is driven in)
  if (w3 && (w3.depth > 0 || session.phase === 'crowbar-prying')) {
    const f3 = session.phase === 'crowbar-prying' ? 1.2 : Math.min(1.2, (w3.depth / 100) * 1.2);
    const p3End = {
      x: w3pt.x + (w1pt.x - w3pt.x) * f3,
      y: w3pt.y + (w1pt.y - w3pt.y) * f3,
    };
    const depth3 = Math.min(1, Math.max(0.15, w3.depth / 100));
    renderHybridFracture(w3pt, p3End, offsets3, depth3, 1.2);

    // Opposite crack growing ~20% backwards behind Wedge 3
    const backF3 = (w3.depth / 100) * 0.20;
    const p3Back = {
      x: w3pt.x - (w1pt.x - w3pt.x) * backF3,
      y: w3pt.y - (w1pt.y - w3pt.y) * backF3,
    };
    renderHybridFracture(w3pt, p3Back, offsetsOpp3, depth3, 0.9);
  }

  const isPryPhaseReady = session.globalLeverage >= 100 || session.phase === 'crowbar-prying';

  // 3. Draw Small Side Splinters around active wedges (matching user Drawing 2!)
  [w1, w2, w3].forEach((w) => {
    if (w && w.depth > 15) {
      const wx = (w.x / 100) * width;
      const wy = (w.y / 100) * height;
      const sideLength = (w.depth / 100) * 16;
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.7;

      // Splinter 1 (top-left)
      ctx.beginPath();
      ctx.moveTo(wx, wy);
      ctx.lineTo(wx - sideLength * 0.7, wy - sideLength * 0.8);
      ctx.stroke();

      // Splinter 2 (bottom-right)
      ctx.beginPath();
      ctx.moveTo(wx, wy);
      ctx.lineTo(wx + sideLength * 0.8, wy + sideLength * 0.6);
      ctx.stroke();
    }
  });

  // 4. Glowing Video-Style Yellow "Pry Spot" Target Ring ON THE CRACK SEAM at (48, 72) (matching user Drawing 2!)
  if (isPryPhaseReady) {
    ctx.save();
    ctx.translate(pryPt.x, pryPt.y);

    // Outer pulsing yellow glow ring
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#fbbf24';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.stroke();

    // Inner yellow ring
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.stroke();

    // Center target socket
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();

    // Instruction label
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 4;
    ctx.fillText('PRY SPOT (CROWBAR HERE)', 0, 36);

    ctx.restore();
  }

  ctx.restore();
}

function drawUpcomingWedgeTarget(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  wedge: MiningSessionState['wedges'][0],
  idx: number
) {
  const wx = (wedge.x / 100) * width;
  const wy = (wedge.y / 100) * height;

  ctx.save();
  ctx.translate(wx, wy);

  // 1. Drilled Borehole waiting for wedge
  ctx.fillStyle = '#090d16';
  ctx.beginPath();
  ctx.ellipse(0, 0, 16, 11, 0, 0, Math.PI * 2);
  ctx.fill();

  // Chiseled collar lip
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // 2. Translucent ghost blueprint silhouette of the wedge ready to be inserted
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.moveTo(-6, -26);
  ctx.lineTo(6, -26);
  ctx.lineTo(3, 4);
  ctx.lineTo(-3, 4);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#7dd3fc';
  ctx.beginPath();
  ctx.ellipse(0, -26, 11, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 3. Glowing Tactical Targeting Ring
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 2.5;
  ctx.shadowColor = '#fbbf24';
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.arc(0, -10, 24, 0, Math.PI * 2);
  ctx.stroke();

  // Pulsing inner ring
  ctx.strokeStyle = '#fef08a';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.arc(0, -10, 15, 0, Math.PI * 2);
  ctx.stroke();

  // Center target pip
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.arc(0, -10, 4, 0, Math.PI * 2);
  ctx.fill();

  // Label above target
  ctx.fillStyle = '#fef08a';
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.shadowColor = '#000000';
  ctx.shadowBlur = 4;
  ctx.fillText(`BOREHOLE #${idx + 1} READY`, 0, -38);

  ctx.restore();
}

function drawWedgeAssembly(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  wedge: MiningSessionState['wedges'][0],
  isActive: boolean,
  isHovered: boolean,
  phase: string,
  joltOffset: number = 0
) {
  const wx = (wedge.x / 100) * width;
  const wy = (wedge.y / 100) * height;

  ctx.save();
  ctx.translate(wx, wy);

  // 1. Drilled Borehole in Rock Face (Dark cavity with chiseled rock lip)
  ctx.save();
  const holeGrad = ctx.createRadialGradient(0, -2, 2, 0, 0, 18);
  holeGrad.addColorStop(0, '#030508');
  holeGrad.addColorStop(0.7, '#0f172a');
  holeGrad.addColorStop(1, '#1e293b');
  ctx.fillStyle = holeGrad;
  ctx.beginPath();
  ctx.ellipse(0, 0, 18, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  // Chiseled Rock Rim Lip
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Micro-fracture stress ticks radiating into stone
  ctx.strokeStyle = '#020617';
  ctx.lineWidth = 1.2;
  const crackAngles = [-0.8, 0.5, 2.2, 3.6];
  crackAngles.forEach((ang) => {
    ctx.beginPath();
    ctx.moveTo(Math.cos(ang) * 16, Math.sin(ang) * 10);
    ctx.lineTo(Math.cos(ang) * 24, Math.sin(ang) * 15);
    ctx.stroke();
  });
  ctx.restore();

  // 2. The Two Feathers (Steel shims hooked onto the borehole lip)
  // Left Feather
  ctx.save();
  const leftFeatherGrad = ctx.createLinearGradient(-18, -10, -8, 12);
  leftFeatherGrad.addColorStop(0, '#cbd5e1'); // top hook highlight
  leftFeatherGrad.addColorStop(0.3, '#64748b');
  leftFeatherGrad.addColorStop(1, '#1e293b');
  ctx.fillStyle = leftFeatherGrad;
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-12, -7);
  ctx.quadraticCurveTo(-18, -10, -17, -5);
  ctx.lineTo(-13, 12);
  ctx.lineTo(-8, 10);
  ctx.lineTo(-8, -4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-18, -9);
  ctx.lineTo(-12, -7);
  ctx.stroke();
  ctx.restore();

  // Right Feather
  ctx.save();
  const rightFeatherGrad = ctx.createLinearGradient(8, -10, 18, 12);
  rightFeatherGrad.addColorStop(0, '#94a3b8');
  rightFeatherGrad.addColorStop(0.4, '#475569');
  rightFeatherGrad.addColorStop(1, '#0f172a');
  ctx.fillStyle = rightFeatherGrad;
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(12, -7);
  ctx.quadraticCurveTo(18, -10, 17, -5);
  ctx.lineTo(13, 12);
  ctx.lineTo(8, 10);
  ctx.lineTo(8, -4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(18, -9);
  ctx.lineTo(12, -7);
  ctx.stroke();
  ctx.restore();

  // 3. Central Forged Steel Wedge (Plug)
  // Sits between the feathers and drives into the rock
  const depthFactor = Math.min(1, Math.max(0, wedge.depth / 100));
  const baseProtrusion = 32 - depthFactor * 24; // 32 down to 8
  const headY = -baseProtrusion + (joltOffset || 0);

  const tiltAngle = !wedge.isSeated ? 0.12 : 0;
  ctx.save();
  ctx.rotate(tiltAngle);

  // Wedge Cast Shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
  ctx.shadowOffsetX = 4;
  ctx.shadowOffsetY = 8;
  ctx.shadowBlur = 8;

  // Wedge Tapered Shank (Left facet, center ridge, right facet)
  // Left Facet (Light catching)
  const leftShankGrad = ctx.createLinearGradient(-10, headY, 0, 2);
  leftShankGrad.addColorStop(0, '#94a3b8');
  leftShankGrad.addColorStop(0.5, '#64748b');
  leftShankGrad.addColorStop(1, '#334155');
  ctx.fillStyle = leftShankGrad;
  ctx.beginPath();
  ctx.moveTo(-9, headY + 3);
  ctx.lineTo(0, headY + 3);
  ctx.lineTo(0, 4);
  ctx.lineTo(-5, 4);
  ctx.closePath();
  ctx.fill();

  // Right Facet (Shadowed)
  const rightShankGrad = ctx.createLinearGradient(0, headY, 10, 2);
  rightShankGrad.addColorStop(0, '#475569');
  rightShankGrad.addColorStop(0.5, '#334155');
  rightShankGrad.addColorStop(1, '#1e293b');
  ctx.fillStyle = rightShankGrad;
  ctx.beginPath();
  ctx.moveTo(0, headY + 3);
  ctx.lineTo(9, headY + 3);
  ctx.lineTo(5, 4);
  ctx.lineTo(0, 4);
  ctx.closePath();
  ctx.fill();

  // Center Ridge Specular Line
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, headY + 3);
  ctx.lineTo(0, 4);
  ctx.stroke();

  // Stamped Depth Graduation Notches on Shank (I, II, III)
  const notchSteps = [0.25, 0.5, 0.75];
  notchSteps.forEach((step) => {
    const notchY = headY + 3 + (4 - (headY + 3)) * step;
    if (notchY < 2) {
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-4, notchY);
      ctx.lineTo(4, notchY);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(-4, notchY + 0.8);
      ctx.lineTo(4, notchY + 0.8);
      ctx.stroke();
    }
  });

  // 4. Forged Steel Striking Crown (Impact Head)
  const crownW = 24;
  const crownH = 14;

  // Crown Side Chamfer
  const crownSideGrad = ctx.createLinearGradient(-crownW / 2, headY - crownH / 2, crownW / 2, headY + crownH / 2);
  crownSideGrad.addColorStop(0, '#64748b');
  crownSideGrad.addColorStop(0.5, '#475569');
  crownSideGrad.addColorStop(1, '#1e293b');
  ctx.fillStyle = crownSideGrad;
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(0, headY + 2, crownW / 2 + 1, crownH / 2 + 1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Mushroomed peened lip highlight from sledgehammer blows
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(0, headY + 2, crownW / 2 + 0.5, Math.PI * 0.9, Math.PI * 2.1);
  ctx.stroke();

  // Striking Face (Top impact flat surface)
  const faceGrad = ctx.createRadialGradient(-3, headY - 2, 2, 0, headY, crownW / 2);
  if (wedge.stability < 50) {
    faceGrad.addColorStop(0, '#fecaca');
    faceGrad.addColorStop(0.4, '#ef4444');
    faceGrad.addColorStop(1, '#7f1d1d');
  } else if (isActive) {
    faceGrad.addColorStop(0, '#f8fafc');
    faceGrad.addColorStop(0.3, '#cbd5e1');
    faceGrad.addColorStop(0.7, '#64748b');
    faceGrad.addColorStop(1, '#334155');
  } else {
    faceGrad.addColorStop(0, '#e2e8f0');
    faceGrad.addColorStop(0.5, '#64748b');
    faceGrad.addColorStop(1, '#1e293b');
  }

  ctx.fillStyle = faceGrad;
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(0, headY, crownW / 2, crownH / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Specular Highlight Arc
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.ellipse(0, headY - 1, crownW / 2 - 2, crownH / 2 - 2, 0, Math.PI * 0.8, Math.PI * 2.2);
  ctx.stroke();

  // Stamped Wedge Identification Number (#1, #2, #3)
  ctx.fillStyle = isActive ? '#0f172a' : '#1e293b';
  ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`#${wedge.id + 1}`, 0, headY);

  // Active / Targeted Specular Aura
  if (isActive) {
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.0;
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.ellipse(0, headY, crownW / 2 + 4, crownH / 2 + 4, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (isHovered) {
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.ellipse(0, headY, crownW / 2 + 3, crownH / 2 + 3, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Thermal Stress Cracks if Stability <= 50%
  if (wedge.stability <= 50) {
    ctx.strokeStyle = '#ffedd5';
    ctx.lineWidth = 1.2;
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(-5, headY - 2);
    ctx.lineTo(-1, headY + 1);
    ctx.lineTo(4, headY - 1);
    ctx.stroke();
  }

  // Status Label Above Wedge
  ctx.shadowBlur = 0;
  if (wedge.depth >= 100) {
    ctx.fillStyle = '#22c55e';
    ctx.font = 'bold 9px sans-serif';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 4;
    ctx.fillText('100% DRIVEN', 0, headY - 14);
  } else if (!wedge.isSeated) {
    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 9px sans-serif';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 4;
    ctx.fillText('UNSEATED', 0, headY - 14);
  } else if (!isActive) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '9px sans-serif';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 4;
    ctx.fillText(`${Math.round(wedge.depth)}%`, 0, headY - 14);
  }

  ctx.restore();
  ctx.restore();
}

function drawWedgeSettingOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  session: MiningSessionState,
  strikeAnim: { startTime: number; duration: number; tier: string } | null
) {
  const activeWedge = session.wedges[session.activeWedgeIndex];
  if (!activeWedge) return;

  const wx = (activeWedge.x / 100) * width;
  const wy = (activeWedge.y / 100) * height;
  const radius = 62;

  // 1. Borehole Dial
  ctx.save();
  ctx.translate(wx, wy);

  // Background guide ring
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.stroke();

  // Target Arcs
  session.targetArcs.forEach((arc) => {
    const startRad = (arc.startAngle * Math.PI) / 180;
    const endRad = ((arc.startAngle + arc.arcWidth) * Math.PI) / 180;

    ctx.strokeStyle = '#22c55e'; // Green center
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(0, 0, radius, startRad, endRad);
    ctx.stroke();

    // Perfect center line mark
    const centerRad = (arc.centerAngle * Math.PI) / 180;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(Math.cos(centerRad) * (radius - 12), Math.sin(centerRad) * (radius - 12));
    ctx.lineTo(Math.cos(centerRad) * (radius + 12), Math.sin(centerRad) * (radius + 12));
    ctx.stroke();
  });

  // Moving Hit Marker
  const markerRad = (session.markerAngle * Math.PI) / 180;
  const mx = Math.cos(markerRad) * radius;
  const my = Math.sin(markerRad) * radius;

  ctx.fillStyle = '#38bdf8';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(mx, my, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Instructions text below ring
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.shadowColor = '#000000';
  ctx.shadowBlur = 6;
  ctx.fillText(`SEAT WEDGE: TARGET ${session.settingStep + 1} OF 3 - TAP SPACE / CLICK`, 0, radius + 28);

  ctx.restore();

  // 2. Animated Sledgehammer Hoisted Overhead Ready to Seat the Wedge
  const depthFactor = Math.min(1, Math.max(0, activeWedge.depth / 100));
  const baseProtrusion = 32 - depthFactor * 24;
  const crownX = wx;
  const crownY = wy - baseProtrusion;

  // Calculate proximity to current target arc
  const currentArc = session.targetArcs[session.settingStep];
  let isSweetSpot = false;
  let windupProgress = 0.35;
  if (currentArc) {
    const diff = Math.abs((session.markerAngle - currentArc.centerAngle + 360) % 360);
    const normalizedDiff = diff > 180 ? 360 - diff : diff;
    if (normalizedDiff <= currentArc.arcWidth / 2) {
      isSweetSpot = true;
      windupProgress = 0.85 + (1 - normalizedDiff / (currentArc.arcWidth / 2)) * 0.15;
    } else {
      const distToArc = normalizedDiff - currentArc.arcWidth / 2;
      const approach = Math.max(0, 1 - distToArc / 80);
      windupProgress = 0.35 + approach * 0.5;
    }
  }

  drawSledgehammer(ctx, crownX, crownY, windupProgress, strikeAnim, isSweetSpot);
}

function drawImpactReticle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  isSweetSpot: boolean
) {
  ctx.save();
  ctx.translate(cx, cy);

  const perfectR = 18; // Sweet spot inner core matching wedge crown

  // 1. Inner Sweet-Spot Target Ring on the Wedge Crown
  ctx.save();
  if (isSweetSpot) {
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#4ade80';
    ctx.shadowBlur = 14;
  } else {
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
  }
  ctx.beginPath();
  ctx.ellipse(0, 0, perfectR, perfectR * 0.75, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // 2. Precision Crosshair Tick Marks
  ctx.strokeStyle = isSweetSpot ? '#4ade80' : 'rgba(203, 213, 225, 0.6)';
  ctx.lineWidth = 1.5;
  const tickLen = 6;
  // North
  ctx.beginPath();
  ctx.moveTo(0, -perfectR * 0.75 - tickLen);
  ctx.lineTo(0, -perfectR * 0.75);
  ctx.stroke();
  // South
  ctx.beginPath();
  ctx.moveTo(0, perfectR * 0.75);
  ctx.lineTo(0, perfectR * 0.75 + tickLen);
  ctx.stroke();
  // East
  ctx.beginPath();
  ctx.moveTo(perfectR, 0);
  ctx.lineTo(perfectR + tickLen, 0);
  ctx.stroke();
  // West
  ctx.beginPath();
  ctx.moveTo(-perfectR - tickLen, 0);
  ctx.lineTo(-perfectR, 0);
  ctx.stroke();

  // 3. Outer Contracting Kinetic Impact Wave Ring
  const currentR = Math.max(perfectR, radius);
  const ringColor = isSweetSpot
    ? '#22c55e'
    : currentR <= 45
    ? '#f59e0b'
    : 'rgba(148, 163, 184, 0.55)';

  ctx.save();
  ctx.strokeStyle = ringColor;
  ctx.lineWidth = isSweetSpot ? 3.5 : 2.5;
  if (isSweetSpot) {
    ctx.shadowColor = '#22c55e';
    ctx.shadowBlur = 10;
  }
  ctx.beginPath();
  ctx.ellipse(0, 0, currentR, currentR * 0.75, 0, 0, Math.PI * 2);
  ctx.stroke();

  // 4 Directional Chevrons pointing inward along the contracting ring
  const chevDist = currentR;
  const chevSize = 4;
  ctx.fillStyle = ringColor;
  // Top chevron (pointing down)
  ctx.beginPath();
  ctx.moveTo(0, -chevDist * 0.75 + chevSize);
  ctx.lineTo(-chevSize, -chevDist * 0.75 - chevSize);
  ctx.lineTo(chevSize, -chevDist * 0.75 - chevSize);
  ctx.closePath();
  ctx.fill();

  // Bottom chevron (pointing up)
  ctx.beginPath();
  ctx.moveTo(0, chevDist * 0.75 - chevSize);
  ctx.lineTo(-chevSize, chevDist * 0.75 + chevSize);
  ctx.lineTo(chevSize, chevDist * 0.75 + chevSize);
  ctx.closePath();
  ctx.fill();

  // Right chevron (pointing left)
  ctx.beginPath();
  ctx.moveTo(chevDist - chevSize, 0);
  ctx.lineTo(chevDist + chevSize, -chevSize);
  ctx.lineTo(chevDist + chevSize, chevSize);
  ctx.closePath();
  ctx.fill();

  // Left chevron (pointing right)
  ctx.beginPath();
  ctx.moveTo(-chevDist + chevSize, 0);
  ctx.lineTo(-chevDist - chevSize, -chevSize);
  ctx.lineTo(-chevDist - chevSize, chevSize);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // 4. Dynamic Interactive HUD Prompt
  ctx.save();
  ctx.textAlign = 'center';
  ctx.shadowColor = '#000000';
  ctx.shadowBlur = 6;
  if (isSweetSpot) {
    ctx.fillStyle = '#4ade80';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('STRIKE NOW! [SPACE / CLICK]', 0, currentR * 0.75 + 24);
  } else {
    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('TIMING STRIKE... [SPACE / CLICK]', 0, currentR * 0.75 + 22);
  }
  ctx.restore();

  ctx.restore();
}

function drawSledgehammer(
  ctx: CanvasRenderingContext2D,
  targetX: number,
  targetY: number,
  windupProgress: number,
  strikeAnim: { startTime: number; duration: number; tier: string } | null,
  isSweetSpot: boolean
) {
  // Target is the top flat surface of the wedge crown (crownX, crownY)
  // Overhead Windup Stance:
  // The hammer is raised high UPWARD into the air above the wedge crown.
  // As windupProgress increases (0 to 1), it hoists higher and cocks back.
  const baseHoistY = 72;
  const maxHoistExtraY = 32;
  const windupHeadX = targetX + 16 + windupProgress * 18;
  const windupHeadY = targetY - baseHoistY - windupProgress * maxHoistExtraY;
  const windupAngle = 48 + windupProgress * 26; // 48° to 74° tilted upward-right

  // Organic idle breathing sway
  const breathe = Math.sin(performance.now() * 0.005) * 2.5;
  const restingHeadX = windupHeadX + breathe * 0.4;
  const restingHeadY = windupHeadY + breathe;
  const restingAngle = windupAngle + breathe * 0.3;

  let headX = restingHeadX;
  let headY = restingHeadY;
  let angleDeg = restingAngle;
  let isDownswing = false;
  let downswingNorm = 0;

  // Impact position when bottom striking face (at local y = +14) lands flat on wedge crown (targetX, targetY)
  const impactHeadX = targetX;
  const impactHeadY = targetY - 14;
  const impactAngle = -5; // slightly downward angle so bottom striking face lands flat

  if (strikeAnim) {
    const elapsed = performance.now() - strikeAnim.startTime;
    const dur = strikeAnim.duration || 300;
    const p = Math.min(1, Math.max(0, elapsed / dur));

    if (p < 0.35) {
      // --- STAGE 1: POWERFUL DOWNWARD SWING ---
      isDownswing = true;
      downswingNorm = p / 0.35;
      // Cubic acceleration curve: starts coiled and accelerates down violently
      const ease = downswingNorm * downswingNorm * downswingNorm;

      headX = restingHeadX + (impactHeadX - restingHeadX) * ease;
      headY = restingHeadY + (impactHeadY - restingHeadY) * ease;
      angleDeg = restingAngle + (impactAngle - restingAngle) * ease;
    } else if (p < 0.60) {
      // --- STAGE 2: ELASTIC RECOIL BOUNCE OFF WEDGE CROWN ---
      const recoilNorm = (p - 0.35) / (0.60 - 0.35);
      const bounce = Math.sin(recoilNorm * Math.PI);

      headX = impactHeadX + bounce * 10;
      headY = impactHeadY - bounce * 32;
      angleDeg = impactAngle + bounce * 28;
    } else {
      // --- STAGE 3: RECOVERY BACK TO OVERHEAD STANCE ---
      const recoverNorm = (p - 0.60) / (1.0 - 0.60);
      const ease = Math.sin(recoverNorm * (Math.PI / 2));

      const recoilExitX = impactHeadX + 10;
      const recoilExitY = impactHeadY - 32;
      const recoilExitAngle = impactAngle + 28;

      headX = recoilExitX + (restingHeadX - recoilExitX) * ease;
      headY = recoilExitY + (restingHeadY - recoilExitY) * ease;
      angleDeg = recoilExitAngle + (restingAngle - recoilExitAngle) * ease;
    }
  }

  ctx.save();

  // 1. Motion Blur / Velocity Streaks during Downward Power Swing
  if (isDownswing && downswingNorm > 0.15) {
    ctx.save();
    ctx.strokeStyle = isSweetSpot ? 'rgba(56, 189, 248, 0.65)' : 'rgba(241, 245, 249, 0.45)';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';

    for (let t = 1; t <= 3; t++) {
      const trailP = Math.max(0, downswingNorm - t * 0.12);
      const trailEase = trailP * trailP * trailP;
      const tHeadX = restingHeadX + (impactHeadX - restingHeadX) * trailEase;
      const tHeadY = restingHeadY + (impactHeadY - restingHeadY) * trailEase;

      ctx.beginPath();
      ctx.arc(tHeadX, tHeadY, 14 + t * 4, -Math.PI * 0.4, Math.PI * 0.1);
      ctx.stroke();
    }
    ctx.restore();
  }

  // 2. Realistic Dynamic Drop Shadow on Slate Rock Surface
  const distFromWall = Math.max(8, targetY - headY);
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  ctx.shadowOffsetX = 8 + distFromWall * 0.08;
  ctx.shadowOffsetY = 12 + distFromWall * 0.14;
  ctx.shadowBlur = 6 + distFromWall * 0.1;

  // 3. Coordinate Transform to Hammer Head Origin
  ctx.translate(headX, headY);
  ctx.rotate((-angleDeg * Math.PI) / 180);

  // --- HAMMER HANDLE (Hickory / Ash Wood extending up-right along local +X) ---
  const handleLen = 135;
  const handleGrad = ctx.createLinearGradient(0, -5, 0, 5);
  handleGrad.addColorStop(0, '#fef08a'); // top highlight
  handleGrad.addColorStop(0.25, '#d97706'); // warm honey grain
  handleGrad.addColorStop(0.75, '#b45309'); // rich aged chestnut
  handleGrad.addColorStop(1, '#78350f'); // bottom shadow
  ctx.fillStyle = handleGrad;
  ctx.strokeStyle = '#451a03';
  ctx.lineWidth = 1;

  ctx.beginPath();
  // Ergonomic tapering handle flare
  ctx.moveTo(0, -3.5);
  ctx.lineTo(45, -3.8);
  ctx.lineTo(90, -4.5);
  ctx.lineTo(handleLen, -5.2);
  ctx.lineTo(handleLen, 5.2);
  ctx.lineTo(90, 4.5);
  ctx.lineTo(45, 3.8);
  ctx.lineTo(0, 3.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Dark Textured Leather Grip Wraps
  const gripStart = 58;
  const gripEnd = 124;
  const wrapGrad = ctx.createLinearGradient(0, -5, 0, 5);
  wrapGrad.addColorStop(0, '#475569');
  wrapGrad.addColorStop(0.5, '#1e293b');
  wrapGrad.addColorStop(1, '#0f172a');
  ctx.fillStyle = wrapGrad;

  for (let gx = gripStart; gx <= gripEnd; gx += 11) {
    ctx.beginPath();
    ctx.moveTo(gx, -5);
    ctx.lineTo(gx + 9, -5);
    ctx.lineTo(gx + 7, 5);
    ctx.lineTo(gx - 2, 5);
    ctx.closePath();
    ctx.fill();

    // Cross-stitch lacing
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(gx + 1, -4);
    ctx.lineTo(gx + 6, 4);
    ctx.stroke();
  }

  // Steel Pommel Cap at Handle Base
  ctx.fillStyle = '#64748b';
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.ellipse(handleLen, 0, 4, 6.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Brass Pommel Fastener Pin
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.arc(handleLen - 1, 0, 1.6, 0, Math.PI * 2);
  ctx.fill();

  // Steel Reinforcement Langet Straps (Fastened onto handle from head)
  const langetGrad = ctx.createLinearGradient(0, -3, 0, 3);
  langetGrad.addColorStop(0, '#cbd5e1');
  langetGrad.addColorStop(0.5, '#64748b');
  langetGrad.addColorStop(1, '#334155');
  ctx.fillStyle = langetGrad;
  ctx.fillRect(0, -3, 24, 6);

  // Langet Steel Rivets
  ctx.fillStyle = '#e2e8f0';
  ctx.beginPath();
  ctx.arc(8, 0, 1.4, 0, Math.PI * 2);
  ctx.arc(18, 0, 1.4, 0, Math.PI * 2);
  ctx.fill();

  // --- HAMMER HEAD (Forged Carbon Steel Cylinder along local Y-axis) ---
  // Top peen at y = -14, Striking face at y = +14, Center eye at (0, 0)
  const headGrad = ctx.createLinearGradient(-13, 0, 13, 0);
  headGrad.addColorStop(0, '#64748b'); // light catching bevel
  headGrad.addColorStop(0.3, '#475569');
  headGrad.addColorStop(0.7, '#334155');
  headGrad.addColorStop(1, '#1e293b'); // shadowed bevel
  ctx.fillStyle = headGrad;
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1.5;

  // Chamfered Octagonal Forged Profile
  ctx.beginPath();
  ctx.moveTo(-9, -14);
  ctx.lineTo(9, -14);
  ctx.lineTo(13, -8);
  ctx.lineTo(13, 8);
  ctx.lineTo(9, 14);
  ctx.lineTo(-9, 14);
  ctx.lineTo(-13, 8);
  ctx.lineTo(-13, -8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Daylight Specular Edge Highlight on Upper Facet
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-8, -13);
  ctx.lineTo(8, -13);
  ctx.stroke();

  // Center Eye & Iron Wedge Pin
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.ellipse(0, 0, 7, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Wood end visible in eye
  ctx.fillStyle = '#d97706';
  ctx.beginPath();
  ctx.ellipse(0, 0, 5, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Steel expansion wedge driven into handle end
  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(-1, -3, 2, 6);

  // Top Peen Crown (at y = -14)
  ctx.fillStyle = '#475569';
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(0, -14, 9, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // BOTTOM STRIKING FACE (at y = +14, impacts the wedge crown!)
  const strikeFaceGrad = ctx.createRadialGradient(-2, 13, 1, 0, 14, 10);
  if (isSweetSpot) {
    strikeFaceGrad.addColorStop(0, '#cffafe');
    strikeFaceGrad.addColorStop(0.4, '#38bdf8');
    strikeFaceGrad.addColorStop(1, '#0284c7');
  } else {
    strikeFaceGrad.addColorStop(0, '#f8fafc');
    strikeFaceGrad.addColorStop(0.4, '#cbd5e1');
    strikeFaceGrad.addColorStop(0.8, '#64748b');
    strikeFaceGrad.addColorStop(1, '#334155');
  }

  ctx.fillStyle = strikeFaceGrad;
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.ellipse(0, 14, 11, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Specular rim arc on striking face
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(0, 13.5, 9, 2.5, 0, 0, Math.PI);
  ctx.stroke();

  // Kinetic Glow Arc on Striking Face when in Sweet Spot
  if (isSweetSpot) {
    ctx.strokeStyle = '#4ade80';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#22c55e';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.ellipse(0, 14, 12, 5, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore(); // shadow restore
  ctx.restore(); // main restore
}

function drawHammeringOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  session: MiningSessionState,
  strikeAnim: { startTime: number; duration: number; tier: string } | null
) {
  const activeWedge = session.wedges[session.activeWedgeIndex];
  if (!activeWedge) return;

  const wx = (activeWedge.x / 100) * width;
  const wy = (activeWedge.y / 100) * height;

  const depthFactor = Math.min(1, Math.max(0, activeWedge.depth / 100));
  const baseProtrusion = 32 - depthFactor * 24;
  const crownX = wx;
  const crownY = wy - baseProtrusion;

  const r = session.circleRadius;
  const isSweetSpot = r <= 25;
  const windupProgress = Math.max(0, Math.min(1, (90 - r) / (90 - 22)));

  // 1. Draw Forged Steel Impact Reticle on the Wedge Crown (replaces simple wireframe circle)
  drawImpactReticle(ctx, crownX, crownY, r, isSweetSpot);

  // 2. Draw Realistic Sledgehammer with Dynamic Swing and Recoil
  drawSledgehammer(ctx, crownX, crownY, windupProgress, strikeAnim, isSweetSpot);
}

function drawCrowbarOverlay(ctx: CanvasRenderingContext2D, width: number, height: number, session: MiningSessionState) {
  // 1. Render Metallic Crowbar inserted at Pry Spot on the seam line between Wedge 1 and Wedge 2
  const w1 = session.wedges[0];
  const w2 = session.wedges[1];
  const w1x = ((w1 ? w1.x : 28) / 100) * width;
  const w1y = ((w1 ? w1.y : 55) / 100) * height;
  const w2x = ((w2 ? w2.x : 68) / 100) * width;
  const w2y = ((w2 ? w2.y : 52) / 100) * height;

  const pryX = (w1x + w2x) / 2;
  const pryY = (w1y + w2y) / 2;

  ctx.save();
  ctx.translate(pryX, pryY);

  // Calculate dynamic pry angle based on crowbarPosition (-100 to +100)
  // Angle tilts between -22° (left) and +22° (right)
  const angleRad = ((session.crowbarPosition / 100) * 22 * Math.PI) / 180;
  ctx.rotate(angleRad);

  // Cast shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 15;

  // Crowbar Curved Pry Hook end inserted into crack
  ctx.fillStyle = '#334155';
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Forged Octagonal Steel Shaft extending downward/outward
  const shaftGrad = ctx.createLinearGradient(-10, 0, 10, 130);
  shaftGrad.addColorStop(0, '#94a3b8');
  shaftGrad.addColorStop(0.3, '#cbd5e1');
  shaftGrad.addColorStop(0.7, '#475569');
  shaftGrad.addColorStop(1, '#1e293b');

  ctx.fillStyle = shaftGrad;
  ctx.beginPath();
  ctx.roundRect(-7, 0, 14, 130, 4);
  ctx.fill();
  ctx.stroke();

  // Highlight ridge line down center of metal shaft
  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  ctx.moveTo(0, 5);
  ctx.lineTo(0, 125);
  ctx.stroke();

  // Rubberized Comfort Grip Handle at lower end
  ctx.globalAlpha = 1.0;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(-9, 80, 18, 45);

  // Textured grip ribs
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1;
  for (let gy = 85; gy <= 120; gy += 6) {
    ctx.beginPath();
    ctx.moveTo(-9, gy);
    ctx.lineTo(9, gy);
    ctx.stroke();
  }

  // Crowbar chisel tip at top pry point
  ctx.fillStyle = '#64748b';
  ctx.beginPath();
  ctx.moveTo(-6, 0);
  ctx.lineTo(0, -18);
  ctx.lineTo(6, 0);
  ctx.closePath();
  ctx.fill();

  ctx.restore();

  // 2. Playbar HUD at bottom of screen
  ctx.save();
  ctx.translate(width * 0.5, height * 0.5);

  // Overall Pry Progress Bar at top of overlay
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.strokeStyle = '#0284c7';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-220, -180, 440, 50, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`CROWBAR EXTRACTION IN PROGRESS: ${Math.round(session.crowbarProgress)}%`, 0, -162);

  // Progress fill bar
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(-190, -150, 380, 10);
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(-190, -150, (session.crowbarProgress / 100) * 380, 10);

  // Left and Right Pry Target Zones
  const isTargetLeft = session.crowbarTargetSide === 'left';
  
  // Left side box
  ctx.fillStyle = isTargetLeft ? 'rgba(34, 197, 94, 0.3)' : 'rgba(30, 41, 59, 0.6)';
  ctx.strokeStyle = isTargetLeft ? '#22c55e' : '#475569';
  ctx.lineWidth = isTargetLeft ? 3 : 1;
  ctx.beginPath();
  ctx.roundRect(-200, 100, 180, 65, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = isTargetLeft ? '#4ade80' : '#94a3b8';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('← PRY LEFT', -110, 128);
  ctx.font = '10px sans-serif';
  ctx.fillText('[ Press A or ← / Click Left ]', -110, 148);

  // Right side box
  ctx.fillStyle = !isTargetLeft ? 'rgba(34, 197, 94, 0.3)' : 'rgba(30, 41, 59, 0.6)';
  ctx.strokeStyle = !isTargetLeft ? '#22c55e' : '#475569';
  ctx.lineWidth = !isTargetLeft ? 3 : 1;
  ctx.beginPath();
  ctx.roundRect(20, 100, 180, 65, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = !isTargetLeft ? '#4ade80' : '#94a3b8';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('PRY RIGHT →', 110, 128);
  ctx.font = '10px sans-serif';
  ctx.fillText('[ Press D or → / Click Right ]', 110, 148);

  // 3. Oscillating timing bar track across bottom (-160 to +160)
  ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
  ctx.fillRect(-180, 180, 360, 26);
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(-180, 180, 360, 26);

  // Active target side highlight (Good Pry Zone)
  ctx.fillStyle = 'rgba(34, 197, 94, 0.35)';
  ctx.fillRect(isTargetLeft ? -180 : 0, 180, 180, 26);

  // --- Outer Ends: PERFECT APEX HIT SPOTS (-180 to -125 and +125 to +180) ---
  // Left Perfect Apex Zone
  ctx.fillStyle = isTargetLeft ? 'rgba(245, 158, 11, 0.75)' : 'rgba(245, 158, 11, 0.25)';
  ctx.fillRect(-180, 180, 55, 26);
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(-180, 180, 55, 26);

  // Right Perfect Apex Zone
  ctx.fillStyle = !isTargetLeft ? 'rgba(245, 158, 11, 0.75)' : 'rgba(245, 158, 11, 0.25)';
  ctx.fillRect(125, 180, 55, 26);
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(125, 180, 55, 26);

  // Zone labels
  ctx.fillStyle = '#fef08a';
  ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('⚡ PERFECT', -152, 196);
  ctx.fillText('⚡ PERFECT', 152, 196);

  // Center divider line
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 180);
  ctx.lineTo(0, 206);
  ctx.stroke();

  // Moving Crowbar Hit Indicator Position (Glides smoothly left <-> right)
  const posPx = (session.crowbarPosition / 100) * 160;
  const isMovingRight = (session.crowbarDirection || 1) > 0;
  const inApex = Math.abs(session.crowbarPosition) >= 75;

  ctx.save();
  ctx.translate(posPx, 193);

  // Glowing indicator head (Glows intense gold when inside Perfect Apex Zone!)
  ctx.fillStyle = inApex ? '#f59e0b' : '#38bdf8';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.5;
  ctx.shadowColor = inApex ? '#f59e0b' : '#38bdf8';
  ctx.shadowBlur = inApex ? 14 : 6;

  ctx.beginPath();
  ctx.arc(0, 0, inApex ? 13 : 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Directional Arrow inside indicator head
  ctx.fillStyle = '#0f172a';
  ctx.font = `bold ${inApex ? '12px' : '10px'} sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(inApex ? '⚡' : isMovingRight ? '➔' : '⬅', 0, 0);

  ctx.restore();

  ctx.restore();
}

function drawSpecimenOnGround(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  specimen: MiningSessionState['extractedSpecimen'],
  frameCount: number
) {
  if (!specimen) return;

  const groundX = width * 0.5;
  const groundY = height * 0.82;
  const bounce = Math.sin(frameCount * 0.08) * 4;

  ctx.save();
  ctx.translate(groundX, groundY + bounce);

  // Glowing pedestal circle
  const aura = ctx.createRadialGradient(0, 0, 10, 0, 0, 50);
  aura.addColorStop(0, specimen.color);
  aura.addColorStop(1, 'transparent');
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(0, 0, 50, 0, Math.PI * 2);
  ctx.fill();

  // Specimen Rock Shape
  ctx.fillStyle = specimen.color;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.moveTo(-25, -15);
  ctx.lineTo(0, -35);
  ctx.lineTo(28, -12);
  ctx.lineTo(20, 20);
  ctx.lineTo(-22, 18);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Shiny sparkle stars
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText('✨', -35, -25);
  ctx.fillText('✨', 25, -20);

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(specimen.name, 0, 38);
  ctx.fillStyle = '#fbbf24';
  ctx.font = '10px sans-serif';
  ctx.fillText(`Yield: ${specimen.yieldAmount}% | Value: $${specimen.value}`, 0, 52);

  ctx.restore();
}
