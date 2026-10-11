import { useState, useEffect } from "react";
import { motion, useScroll, useTransform, useSpring, useReducedMotion } from "motion/react";
import { Orbit, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { type CelestialSystemConfig, type MoonConfig } from "@/lib/celestial-catalog";

interface CategoryCelestialWorldProps {
  system: CelestialSystemConfig;
  className?: string;
}

export function CategoryCelestialWorld({ system, className }: CategoryCelestialWorldProps) {
  const [mounted, setMounted] = useState(false);
  const [hoveredMoon, setHoveredMoon] = useState<MoonConfig | null>(null);
  const prefersReduced = useReducedMotion();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Track page scroll to subtly drift the planetary system
  const { scrollY } = useScroll();
  const smoothY = useSpring(scrollY, { stiffness: 45, damping: 20 });

  // Parallax drifts
  const planetY = useTransform(smoothY, [0, 800], [0, 80]);
  const planetRotate = useTransform(smoothY, [0, 800], [0, 15]);

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

      {/* TOP HEADER & MINOR BRAND LABELING QUOTE */}
      <div className="relative z-20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/30 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-mono tracking-wider uppercase text-muted-foreground">
            <Orbit className="size-3.5 text-primary animate-pulse" />
            <span>{system.systemName}</span>
            <span aria-hidden="true" className="text-border">
              ·
            </span>
            <span>{system.planetName}</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            {system.subtitle}
          </h2>
        </div>

        {/* MINOR BRAND LABELING QUOTE */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
          <Sparkles className="size-3 text-primary shrink-0" />
          <span className="italic">
            Curated by Our Visible Universe · Authentic Astronomical Optics
          </span>
        </div>
      </div>

      {/* MAIN CELESTIAL STAGE */}
      <div className="relative z-10 my-4 flex items-center justify-center min-h-[220px]">
        {/* THEMED CELESTIAL GLOBE & ORBITING MOONS */}
        <div className="relative flex items-center justify-center py-6 w-full">
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
            <motion.div
              whileHover={{ scale: 1.04 }}
              className="group relative z-20 size-32 sm:size-40 rounded-full shadow-2xl transition-transform"
              style={{
                ...(hasDynamicParallax ? { rotate: planetRotate } : {}),
                background: system.cutoutUrl ? undefined : system.textureGradient,
                boxShadow: `inset -18px -18px 30px ${system.shadowColor}, 0 0 40px ${system.coronaGlow}`,
              }}
              aria-label={system.planetName}
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
            </motion.div>

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
                />
              );
            })}
          </motion.div>
        </div>
      </div>

      {hoveredMoon && (
        <div className="text-center pt-2 border-t border-border/30 text-xs font-mono text-primary flex items-center justify-center gap-1.5 animate-fade-in">
          <Sparkles className="size-3 text-primary shrink-0" />
          <span>{hoveredMoon.name} · Orbiting Companion</span>
        </div>
      )}
    </div>
  );
}

interface MoonOrbitProps {
  moon: MoonConfig;
  system: CelestialSystemConfig;
  index: number;
  prefersReduced: boolean;
  onHover: (moon: MoonConfig | null) => void;
}

function MoonOrbit({ moon, system, index, prefersReduced, onHover }: MoonOrbitProps) {
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
          <div
            onMouseEnter={() => onHover(moon)}
            onMouseLeave={() => onHover(null)}
            className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full cursor-pointer shadow-md"
            style={{
              width: `${moon.size}px`,
              height: `${moon.size}px`,
              backgroundColor: moon.color,
              boxShadow: `0 0 16px ${moon.glow}, inset -3px -3px 6px rgba(0,0,0,0.6)`,
            }}
            title={moon.name}
            aria-label={`Moon ${moon.name}`}
          >
            {/* Surface Texture Simulation */}
            <div className="size-full rounded-full bg-gradient-to-tr from-black/50 via-transparent to-white/40" />
          </div>
        </motion.div>
      </div>
    </div>
  );
}
