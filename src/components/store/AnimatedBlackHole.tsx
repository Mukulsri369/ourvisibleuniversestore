import { useEffect, useState } from "react";
import { motion, useScroll, useTransform, useSpring, useReducedMotion } from "motion/react";

export function AnimatedBlackHole() {
  const [mounted, setMounted] = useState(false);
  const prefersReduced = useReducedMotion();

  useEffect(() => {
    setMounted(true);
  }, []);

  const { scrollY } = useScroll();
  const smoothY = useSpring(scrollY, { stiffness: 45, damping: 20 });

  // Parallax scroll effects: moves slightly down, scales, and alters opacity as user scrolls
  const yShift = useTransform(smoothY, [0, 1000], [0, 220]);
  const scale = useTransform(smoothY, [0, 800], [1, 0.82]);
  const opacity = useTransform(smoothY, [0, 900], [0.95, 0.45]);
  const diskRotate = useTransform(smoothY, [0, 1200], [0, 90]);

  const hasAnimation = mounted && !prefersReduced;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 h-[680px] sm:h-[760px] overflow-hidden select-none z-0"
    >
      <motion.div
        style={
          hasAnimation
            ? {
                y: yShift,
                scale,
                opacity,
              }
            : undefined
        }
        className="relative mx-auto flex h-full w-full max-w-7xl items-center justify-center"
      >
        {/* RELATIVISTIC GRAVITATIONAL LENSING AURA */}
        <div
          className="absolute h-[380px] w-[380px] sm:h-[520px] sm:w-[520px] rounded-full blur-3xl opacity-75"
          style={{
            background:
              "radial-gradient(circle, rgba(168, 85, 247, 0.35) 0%, rgba(59, 130, 246, 0.22) 40%, rgba(245, 158, 11, 0.12) 65%, transparent 75%)",
          }}
        />

        {/* SWIRLING ACCRETION DISK (Tilted Ellipse) */}
        <motion.div
          animate={
            prefersReduced
              ? undefined
              : {
                  rotate: [0, 360],
                }
          }
          transition={{
            duration: 35,
            repeat: Infinity,
            ease: "linear",
          }}
          style={hasAnimation ? { rotate: diskRotate } : undefined}
          className="relative flex items-center justify-center w-[340px] sm:w-[500px] h-[340px] sm:h-[500px]"
        >
          {/* Outer Accretion Gas Flare */}
          <div
            className="absolute inset-0 rounded-full blur-xl"
            style={{
              background:
                "conic-gradient(from 180deg at 50% 50%, rgba(245, 158, 11, 0.8) 0deg, rgba(239, 68, 68, 0.6) 80deg, rgba(168, 85, 247, 0.4) 170deg, rgba(59, 130, 246, 0.2) 260deg, rgba(245, 158, 11, 0.8) 360deg)",
              opacity: 0.85,
            }}
          />

          {/* Accretion Ring Distortion Overlay (Upper and Lower Warped Lensing Ring) */}
          <div
            className="absolute w-[112%] h-[42%] rounded-full border-4 border-amber-300/60 blur-xs"
            style={{
              boxShadow: "0 0 35px rgba(245, 158, 11, 0.75), inset 0 0 25px rgba(239, 68, 68, 0.6)",
              transform: "rotateX(72deg)",
            }}
          />
          <div
            className="absolute w-[124%] h-[46%] rounded-full border border-purple-400/40 blur-sm"
            style={{
              transform: "rotateX(72deg)",
            }}
          />
        </motion.div>

        {/* INNER PHOTON SPHERE RING */}
        <motion.div
          animate={
            prefersReduced
              ? undefined
              : {
                  scale: [1, 1.03, 1],
                  opacity: [0.85, 1, 0.85],
                }
          }
          transition={{
            duration: 4.2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute h-[170px] w-[170px] sm:h-[240px] sm:w-[240px] rounded-full border-2 border-amber-200/90"
          style={{
            boxShadow:
              "0 0 45px rgba(245, 158, 11, 0.8), 0 0 80px rgba(168, 85, 247, 0.6), inset 0 0 25px rgba(255, 255, 255, 0.8)",
          }}
        />

        {/* PURE BLACK EVENT HORIZON */}
        <div
          className="absolute h-[150px] w-[150px] sm:h-[214px] sm:w-[214px] rounded-full bg-black z-10"
          style={{
            boxShadow: "inset 0 0 30px rgba(0, 0, 0, 0.95), 0 0 20px rgba(0, 0, 0, 0.8)",
          }}
        />

        {/* RELATIVISTIC BEAM JET (Subtle vertical atmospheric emission) */}
        <div
          className="absolute -top-32 h-64 w-1 sm:w-1.5 bg-gradient-to-t from-cyan-400/60 via-purple-500/30 to-transparent blur-xs opacity-70"
          style={{
            transform: "rotate(-18deg)",
          }}
        />
        <div
          className="absolute -bottom-32 h-64 w-1 sm:w-1.5 bg-gradient-to-b from-cyan-400/60 via-purple-500/30 to-transparent blur-xs opacity-70"
          style={{
            transform: "rotate(-18deg)",
          }}
        />

        {/* STARLIGHT EXTINCTION RADIAL FALLOFF */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(circle at 50% 50%, transparent 25%, rgba(10, 10, 15, 0.3) 60%, rgba(10, 10, 15, 0.85) 90%)",
          }}
        />
      </motion.div>
    </div>
  );
}
