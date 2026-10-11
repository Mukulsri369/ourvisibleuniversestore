import { useState, useEffect } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  useReducedMotion,
  AnimatePresence,
} from "motion/react";
import { Compass, Sparkles, X, Orbit, Activity, ShieldCheck, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { type CelestialSystemConfig, type MoonConfig } from "@/lib/celestial-catalog";

interface CategoryCelestialWorldProps {
  system: CelestialSystemConfig;
  className?: string;
}

export function CategoryCelestialWorld({ system, className }: CategoryCelestialWorldProps) {
  const [mounted, setMounted] = useState(false);
  const [showTelemetry, setShowTelemetry] = useState(false);
  const [hoveredMoon, setHoveredMoon] = useState<MoonConfig | null>(null);
  const prefersReduced = useReducedMotion();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Track page scroll to subtly drift the planetary system
  const { scrollY } = useScroll();
  const smoothY = useSpring(scrollY, { stiffness: 45, damping: 20 });

  // Parallax drifts
  const planetY = useTransform(smoothY, [0, 800], [0, 90]);
  const planetRotate = useTransform(smoothY, [0, 800], [0, 18]);
  const moonParallax = useTransform(smoothY, [0, 800], [0, 140]);

  const hasDynamicParallax = mounted && !prefersReduced;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl border border-border/40 bg-card/30 p-6 sm:p-8 backdrop-blur-md",
        className,
      )}
    >
      {/* AMBIENT CELESTIAL BACKGROUND & STAR DUST */}
      <div
        className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full blur-3xl transition-opacity duration-1000"
        style={{
          background: `radial-gradient(circle, ${system.coronaGlow} 0%, ${system.auraSecondary} 45%, transparent 75%)`,
          opacity: 0.65,
        }}
      />
      <div
        className="pointer-events-none absolute -left-20 -bottom-20 h-72 w-72 rounded-full blur-2xl transition-opacity duration-1000"
        style={{
          background: `radial-gradient(circle, ${system.auraSecondary} 0%, transparent 70%)`,
          opacity: 0.35,
        }}
      />

      {/* TOP HEADER & TELEMETRY CONTROLS */}
      <div className="relative z-20 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-mono tracking-wider uppercase text-muted-foreground">
            <Orbit className="size-3.5 text-primary animate-pulse" />
            <span>{system.systemName}</span>
            <span aria-hidden="true" className="text-border">
              ·
            </span>
            <span>{system.subtitle}</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <span>{system.planetName}</span>
            <span className="text-xs font-normal font-mono px-2 py-0.5 rounded-full border border-border/50 text-muted-foreground">
              {system.telemetry.classification.split("·")[0]?.trim()}
            </span>
          </h2>
        </div>

        {/* INTERACTIVE TELEMETRY HUD TRIGGER */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowTelemetry(!showTelemetry)}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl border px-3.5 py-1.5 text-xs font-mono font-medium transition-all duration-200",
              showTelemetry
                ? "border-primary bg-primary/20 text-primary shadow-lg shadow-primary/20"
                : "border-border/60 bg-background/60 text-muted-foreground hover:text-foreground hover:border-primary/50",
            )}
            aria-expanded={showTelemetry}
            aria-label="Toggle astronomical telemetry display"
          >
            <Activity className="size-3.5 text-primary" />
            <span>{showTelemetry ? "Hide Telemetry HUD" : "Inspect Celestial Telemetry"}</span>
          </button>
        </div>
      </div>

      {/* MAIN CELESTIAL STAGE */}
      <div className="relative z-10 my-4 flex flex-col md:flex-row items-center justify-between gap-6 min-h-[220px]">
        {/* LEFT / CENTER: THEMED CELESTIAL GLOBE & ORBITING MOONS */}
        <div className="relative flex-1 flex items-center justify-center py-4 w-full">
          <motion.div
            style={hasDynamicParallax ? { y: planetY } : undefined}
            className="relative flex items-center justify-center"
          >
            {/* ATMOSPHERIC CORONA BREATHING PULSE */}
            <motion.div
              animate={
                prefersReduced
                  ? undefined
                  : {
                      scale: [1, 1.08, 1],
                      opacity: [0.65, 0.9, 0.65],
                    }
              }
              transition={{
                duration: 5.5,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="pointer-events-none absolute -inset-8 rounded-full blur-2xl"
              style={{
                background: `radial-gradient(circle, ${system.coronaGlow} 0%, ${system.auraSecondary} 55%, transparent 75%)`,
              }}
            />

            {/* PLANETARY RING SYSTEM (FOR SATURN, URANUS, PULSAR, KEPLER) */}
            {system.hasRings && (
              <div
                className="pointer-events-none absolute z-15 w-64 sm:w-80 h-16 sm:h-20 rounded-full border-2 border-yellow-200/40"
                style={{
                  background: system.ringColor,
                  transform: "rotateX(74deg) rotateZ(-18deg)",
                  boxShadow: `0 0 30px ${system.primaryColor}88`,
                }}
              />
            )}

            {/* PRIMARY PLANET GLOBE */}
            <motion.button
              type="button"
              onClick={() => setShowTelemetry(true)}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.98 }}
              className="group relative z-20 size-32 sm:size-40 rounded-full cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-2xl transition-transform"
              style={{
                ...(hasDynamicParallax ? { rotate: planetRotate } : {}),
                background: system.cutoutUrl ? undefined : system.textureGradient,
                boxShadow: `inset -18px -18px 30px ${system.shadowColor}, 0 0 40px ${system.coronaGlow}`,
              }}
              title={`Click to inspect ${system.planetName} telemetry`}
              aria-label={`Inspect ${system.planetName} telemetry`}
            >
              {system.cutoutUrl ? (
                <img
                  src={system.cutoutUrl}
                  alt={system.planetName}
                  className="size-full rounded-full object-cover filter drop-shadow-lg"
                  loading="lazy"
                />
              ) : (
                <div className="relative size-full rounded-full overflow-hidden">
                  {/* Surface Shading & Specular Rim */}
                  <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-black/60 via-transparent to-white/30 pointer-events-none" />
                  <div
                    className="absolute inset-0 rounded-full pointer-events-none"
                    style={{
                      boxShadow: `inset 4px 4px 12px rgba(255,255,255,0.4), inset -12px -12px 24px ${system.shadowColor}`,
                    }}
                  />
                </div>
              )}

              {/* Hover Badge */}
              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-background/90 border border-border/60 px-2.5 py-0.5 text-[10px] font-mono text-muted-foreground shadow-sm">
                Tap to Inspect HUD
              </div>
            </motion.button>

            {/* ORBITING MOONS */}
            {system.moons.map((moon, index) => {
              return (
                <MoonOrbit
                  key={moon.id}
                  moon={moon}
                  system={system}
                  index={index}
                  prefersReduced={!!prefersReduced}
                  onHover={setHoveredMoon}
                  onClick={() => setShowTelemetry(true)}
                />
              );
            })}
          </motion.div>
        </div>

        {/* RIGHT / SIDE: QUICK CELESTIAL METRICS & LORE */}
        <div className="relative z-20 w-full md:max-w-xs space-y-3 rounded-2xl border border-border/30 bg-background/40 p-4 backdrop-blur-md">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-mono">
            <span className="flex items-center gap-1.5">
              <Compass className="size-3 text-primary" />
              <span>ORBITAL COORDINATES</span>
            </span>
            <span className="text-foreground/80">{system.telemetry.orbitalPeriod}</span>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
            {system.telemetry.astronomicalLore}
          </p>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/40 text-[11px] font-mono">
            <div>
              <span className="text-muted-foreground block text-[9px] uppercase">Gravity</span>
              <span className="text-foreground font-semibold">
                {system.telemetry.surfaceGravity}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[9px] uppercase">Radius</span>
              <span className="text-foreground font-semibold">
                {system.telemetry.equatorialRadius.split("(")[0]}
              </span>
            </div>
          </div>

          {hoveredMoon && (
            <div className="pt-2 border-t border-border/40 flex items-center gap-2 text-xs font-mono text-primary animate-fade-in">
              <Sparkles className="size-3 text-primary shrink-0" />
              <span className="truncate">
                {hoveredMoon.name}: {hoveredMoon.description}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* EXPANDABLE TELEMETRY HUD MODAL / DRAWER */}
      <AnimatePresence>
        {showTelemetry && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="relative z-30 mt-4 overflow-hidden rounded-2xl border border-primary/40 bg-card/90 p-4 sm:p-6 backdrop-blur-xl shadow-2xl"
          >
            <div className="flex items-center justify-between pb-3 border-b border-border/40">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-primary" />
                <h3 className="font-mono text-sm uppercase tracking-wider text-foreground font-semibold">
                  {system.planetName} Deep Astronomical Telemetry
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowTelemetry(false)}
                className="rounded-lg p-1 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                aria-label="Close telemetry HUD"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
              <div className="rounded-xl border border-border/40 bg-background/50 p-3">
                <span className="text-[10px] uppercase text-muted-foreground block mb-1">
                  Classification
                </span>
                <span className="text-foreground font-semibold">
                  {system.telemetry.classification}
                </span>
              </div>
              <div className="rounded-xl border border-border/40 bg-background/50 p-3">
                <span className="text-[10px] uppercase text-muted-foreground block mb-1">
                  Equatorial Span
                </span>
                <span className="text-foreground font-semibold">
                  {system.telemetry.equatorialRadius}
                </span>
              </div>
              <div className="rounded-xl border border-border/40 bg-background/50 p-3">
                <span className="text-[10px] uppercase text-muted-foreground block mb-1">
                  Surface Gravity
                </span>
                <span className="text-foreground font-semibold">
                  {system.telemetry.surfaceGravity}
                </span>
              </div>
              <div className="rounded-xl border border-border/40 bg-background/50 p-3">
                <span className="text-[10px] uppercase text-muted-foreground block mb-1">
                  Atmosphere
                </span>
                <span className="text-foreground font-semibold">
                  {system.telemetry.atmosphereComposition}
                </span>
              </div>
              <div className="rounded-xl border border-border/40 bg-background/50 p-3">
                <span className="text-[10px] uppercase text-muted-foreground block mb-1">
                  Mean Temp
                </span>
                <span className="text-foreground font-semibold">
                  {system.telemetry.temperature}
                </span>
              </div>
              <div className="rounded-xl border border-border/40 bg-background/50 p-3">
                <span className="text-[10px] uppercase text-muted-foreground block mb-1">
                  Key Exploration
                </span>
                <span className="text-foreground font-semibold">{system.telemetry.mission}</span>
              </div>
              <div className="sm:col-span-2 rounded-xl border border-border/40 bg-background/50 p-3">
                <span className="text-[10px] uppercase text-muted-foreground block mb-1">
                  Known Natural Satellites
                </span>
                <div className="flex flex-wrap gap-2 mt-1">
                  {system.moons.map((m) => (
                    <span
                      key={m.id}
                      className="inline-flex items-center gap-1 rounded bg-muted/60 px-2 py-0.5 text-[11px] text-foreground"
                    >
                      <span
                        className="size-1.5 rounded-full"
                        style={{ backgroundColor: m.color }}
                      />
                      <span>{m.name}</span>
                    </span>
                  ))}
                  {system.moons.length === 0 && (
                    <span className="text-muted-foreground">No major satellites</span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-border/30 bg-muted/20 p-3 text-xs text-muted-foreground leading-relaxed">
              <span className="font-semibold text-foreground mr-1">Cosmic Context:</span>
              {system.telemetry.astronomicalLore}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface MoonOrbitProps {
  moon: MoonConfig;
  system: CelestialSystemConfig;
  index: number;
  prefersReduced: boolean;
  onHover: (moon: MoonConfig | null) => void;
  onClick: () => void;
}

function MoonOrbit({ moon, system, index, prefersReduced, onHover, onClick }: MoonOrbitProps) {
  // CSS orbital rotation calculation
  const animDuration = moon.orbitDuration;

  return (
    <div
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
      style={{
        zIndex: 25,
      }}
    >
      {/* ORBITAL PATH GUIDE RING */}
      <div
        className="absolute rounded-full border border-dashed border-border/25 pointer-events-none"
        style={{
          width: `${moon.orbitRadiusX * 2}px`,
          height: `${moon.orbitRadiusY * 2}px`,
          transform: "rotateZ(-12deg)",
        }}
      />

      {/* ORBITING MOON CONTAINER */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: `${moon.orbitRadiusX * 2}px`,
          height: `${moon.orbitRadiusY * 2}px`,
          transform: "rotateZ(-12deg)",
        }}
      >
        <motion.div
          animate={
            prefersReduced
              ? undefined
              : {
                  rotate: 360,
                }
          }
          transition={{
            duration: animDuration,
            repeat: Infinity,
            ease: "linear",
          }}
          className="relative size-full pointer-events-auto"
        >
          <motion.button
            type="button"
            onMouseEnter={() => onHover(moon)}
            onMouseLeave={() => onHover(null)}
            onClick={onClick}
            whileHover={{ scale: 1.25 }}
            className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full cursor-pointer shadow-md focus:outline-none focus-visible:ring-1 focus-visible:ring-primary"
            style={{
              width: `${moon.size}px`,
              height: `${moon.size}px`,
              backgroundColor: moon.color,
              boxShadow: `0 0 16px ${moon.glow}, inset -3px -3px 6px rgba(0,0,0,0.6)`,
            }}
            title={`${moon.name}: ${moon.description}`}
            aria-label={`Inspect moon ${moon.name}`}
          >
            {/* Surface Texture Simulation */}
            <div className="size-full rounded-full bg-gradient-to-tr from-black/50 via-transparent to-white/40" />
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
}
