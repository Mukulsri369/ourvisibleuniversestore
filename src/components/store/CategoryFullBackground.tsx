import { useEffect, useState } from "react";
import { motion, useScroll, useTransform, useSpring, useReducedMotion } from "motion/react";
import { type CelestialSystemConfig } from "@/lib/celestial-catalog";

interface CategoryFullBackgroundProps {
  system: CelestialSystemConfig;
}

export function CategoryFullBackground({ system }: CategoryFullBackgroundProps) {
  const [mounted, setMounted] = useState(false);
  const prefersReduced = useReducedMotion();

  useEffect(() => {
    setMounted(true);
  }, []);

  const { scrollY } = useScroll();
  const smoothY = useSpring(scrollY, { stiffness: 35, damping: 25 });

  // Parallax translations from top to bottom of the page
  const planetY = useTransform(smoothY, [0, 1500], [0, 240]);
  const planetRotate = useTransform(smoothY, [0, 2000], [0, 45]);
  const topAuraY = useTransform(smoothY, [0, 2000], [0, 480]);
  const midAuraY = useTransform(smoothY, [0, 2500], [0, 750]);
  const botAuraY = useTransform(smoothY, [0, 3000], [0, 600]);
  const starfieldShiftY = useTransform(smoothY, [0, 2500], [0, -320]);

  const hasAnimation = mounted && !prefersReduced;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden select-none z-0 min-h-full"
    >
      {/* 1. TOP CELESTIAL WATERMARK / PLANET ORB (BEHIND HEADER) */}
      <motion.div
        style={{
          y: hasAnimation ? planetY : 0,
          rotate: hasAnimation ? planetRotate : 0,
        }}
        className="absolute -top-12 right-[-5%] sm:right-[4%] lg:right-[10%] flex items-center justify-center pointer-events-none opacity-40 sm:opacity-55"
      >
        {/* Atmospheric Glow */}
        <div
          className="absolute size-[320px] sm:size-[420px] rounded-full blur-3xl"
          style={{
            background: `radial-gradient(circle, ${system.coronaGlow} 0%, ${system.auraSecondary} 55%, transparent 75%)`,
          }}
        />

        {/* Planet Globe / Cutout Watermark */}
        <div
          className="relative size-44 sm:size-60 rounded-full shadow-2xl"
          style={{
            background: system.cutoutUrl ? undefined : system.textureGradient,
            boxShadow: `inset -20px -20px 40px ${system.shadowColor}, 0 0 50px ${system.coronaGlow}`,
          }}
        >
          {system.cutoutUrl ? (
            <img
              src={system.cutoutUrl}
              alt=""
              className="size-full rounded-full object-cover opacity-80"
              loading="lazy"
            />
          ) : (
            <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-black/55 via-transparent to-white/20" />
          )}

          {/* Planetary Rings if present */}
          {system.hasRings && (
            <div
              className="absolute -inset-10 rounded-full border-2 border-yellow-200/30 opacity-70"
              style={{
                background: system.ringColor,
                transform: "rotateX(72deg) rotateZ(-20deg)",
              }}
            />
          )}
        </div>
      </motion.div>

      {/* 2. TOP CORONA PULSE (UPPER ATMOSPHERE) */}
      <motion.div
        style={{
          y: hasAnimation ? topAuraY : 0,
          background: `radial-gradient(circle, ${system.coronaGlow} 0%, ${system.auraSecondary} 45%, transparent 75%)`,
        }}
        className="absolute -top-32 left-[5%] h-[550px] w-[550px] rounded-full blur-[110px] opacity-35"
      />

      {/* 3. MID-PAGE CELESTIAL DRIFT (FOLLOWS USER DOWN) */}
      <motion.div
        style={{
          y: hasAnimation ? midAuraY : 0,
          background: `radial-gradient(circle, ${system.auraSecondary} 0%, ${system.shadowColor} 60%, transparent 80%)`,
        }}
        className="absolute top-[35%] left-[-10%] h-[680px] w-[680px] rounded-full blur-[130px] opacity-30"
      />

      {/* 4. BOTTOM-PAGE LORE GLOW (VISIBLE DOWN TO FOOTER) */}
      <motion.div
        style={{
          y: hasAnimation ? botAuraY : 0,
          background: `radial-gradient(circle, ${system.primaryColor}40 0%, ${system.auraSecondary} 45%, transparent 75%)`,
        }}
        className="absolute bottom-24 right-[-5%] h-[600px] w-[600px] rounded-full blur-[110px] opacity-30"
      />

      {/* 5. FULL-HEIGHT DENSE MOVING STARFIELD GRID */}
      <motion.div
        style={{
          y: hasAnimation ? starfieldShiftY : 0,
          backgroundImage: `radial-gradient(${system.primaryColor} 1.2px, transparent 1.2px)`,
          backgroundSize: "44px 44px",
        }}
        className="absolute inset-0 opacity-25"
      />

      {/* 6. FINE COSMIC DUST OVERLAY */}
      <div
        className="absolute inset-0 opacity-15"
        style={{
          backgroundImage: `radial-gradient(circle at 50% 50%, rgba(255,255,255,0.8) 0.5px, transparent 0.5px)`,
          backgroundSize: "22px 22px",
        }}
      />
    </div>
  );
}
