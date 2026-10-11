import { useEffect, useState } from "react";
import { motion, useScroll, useTransform, useSpring, useReducedMotion } from "motion/react";
import { CelestialPlanet, type CelestialPlanetConfig } from "./CelestialPlanet";
import earthCutout from "@/assets/planets/earth-cutout.png.asset.json";
import venusCutout from "@/assets/planets/venus-cutout.png.asset.json";
import marsCutout from "@/assets/planets/mars-cutout.png.asset.json";

const CELESTIAL_CONFIGS: Record<"earth" | "venus" | "mars", CelestialPlanetConfig> = {
  earth: {
    id: "earth",
    name: "Earth",
    cutout: earthCutout.url,
    auraColor: "rgba(56, 189, 248, 0.45)",
    rimColor: "rgba(56, 189, 248, 0.95)",
    shadowColor: "rgba(14, 116, 144, 0.6)",
    description:
      "Our azure home oasis. Discover astronomy gifts, stellar maps and space gear crafted for curious minds.",
    telemetry: {
      distanceAU: "1.00 AU",
      atmosphere: "N₂ 78% · O₂ 21%",
      curatedTheme: "Eco-Tech & Celestial Maps",
      query: "earth",
    },
  },
  venus: {
    id: "venus",
    name: "Venus",
    cutout: venusCutout.url,
    auraColor: "rgba(245, 158, 11, 0.42)",
    rimColor: "rgba(251, 191, 36, 0.95)",
    shadowColor: "rgba(180, 83, 9, 0.6)",
    description:
      "A radiant world wrapped in golden sulfuric clouds. Explore luminous lights, festive lamps and cosmic warmth.",
    telemetry: {
      distanceAU: "0.72 AU",
      atmosphere: "CO₂ 96.5% · 92 bar",
      curatedTheme: "Radiant Lamps & Warmth",
      query: "light",
    },
  },
  mars: {
    id: "mars",
    name: "Mars",
    cutout: marsCutout.url,
    auraColor: "rgba(239, 68, 68, 0.42)",
    rimColor: "rgba(248, 113, 113, 0.95)",
    shadowColor: "rgba(153, 27, 27, 0.6)",
    description:
      "The rust-red frontier of giant canyons and dormant volcanoes. Discover rugged astro tools and space gear.",
    telemetry: {
      distanceAU: "1.52 AU",
      atmosphere: "CO₂ 95% · 0.01 bar",
      curatedTheme: "Explorers & Stargazing Gear",
      query: "telescope",
    },
  },
};

export function CelestialScrollWorld() {
  const [mounted, setMounted] = useState(false);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Hydration safety: do not render window-dependent scroll transforms before client mount
  if (!mounted) {
    return null;
  }

  return <CelestialScrollWorldCanvas reducedMotion={!!reducedMotion} />;
}

function CelestialScrollWorldCanvas({ reducedMotion }: { reducedMotion: boolean }) {
  const { scrollYProgress } = useScroll();

  // Smooth out scroll delta with spring physics for natural celestial inertia
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 70,
    damping: 24,
    restDelta: 0.001,
  });

  // -------------------------------------------------------------
  // EARTH ORBITAL TRAJECTORY (Pops out as viewer scrolls past hero)
  // -------------------------------------------------------------
  // Pop out starting at scroll 0.04 -> 0.12
  const earthScale = useTransform(
    smoothProgress,
    [0, 0.04, 0.1, 0.18, 0.85, 1],
    reducedMotion ? [1, 1, 1, 1, 1, 1] : [0, 0.2, 1.12, 1, 1, 0.95],
  );
  const earthOpacity = useTransform(
    smoothProgress,
    [0, 0.04, 0.09, 0.9, 1],
    reducedMotion ? [0.85, 0.85, 0.85, 0.85, 0.85] : [0, 0.15, 0.95, 0.95, 0.9],
  );
  const earthX = useTransform(
    smoothProgress,
    [0.05, 0.22, 0.45, 0.7, 0.9, 1],
    reducedMotion
      ? ["78vw", "78vw", "78vw", "78vw", "78vw", "78vw"]
      : ["82vw", "76vw", "86vw", "74vw", "80vw", "76vw"],
  );
  const earthY = useTransform(
    smoothProgress,
    [0.05, 0.22, 0.45, 0.7, 0.9, 1],
    reducedMotion
      ? ["25vh", "25vh", "25vh", "25vh", "25vh", "25vh"]
      : ["18vh", "32vh", "48vh", "64vh", "75vh", "80vh"],
  );
  const earthRotate = useTransform(smoothProgress, [0, 1], [0, 180]);

  // -------------------------------------------------------------
  // VENUS ORBITAL TRAJECTORY (Pops out around scroll 0.14 -> 0.22)
  // -------------------------------------------------------------
  const venusScale = useTransform(
    smoothProgress,
    [0, 0.12, 0.18, 0.28, 0.85, 1],
    reducedMotion ? [1, 1, 1, 1, 1, 1] : [0, 0.2, 1.15, 1, 1, 0.92],
  );
  const venusOpacity = useTransform(
    smoothProgress,
    [0, 0.12, 0.17, 0.9, 1],
    reducedMotion ? [0.8, 0.8, 0.8, 0.8, 0.8] : [0, 0.15, 0.92, 0.92, 0.85],
  );
  const venusX = useTransform(
    smoothProgress,
    [0.14, 0.32, 0.55, 0.75, 0.9, 1],
    reducedMotion
      ? ["10vw", "10vw", "10vw", "10vw", "10vw", "10vw"]
      : ["4vw", "16vw", "6vw", "18vw", "8vw", "14vw"],
  );
  const venusY = useTransform(
    smoothProgress,
    [0.14, 0.32, 0.55, 0.75, 0.9, 1],
    reducedMotion
      ? ["45vh", "45vh", "45vh", "45vh", "45vh", "45vh"]
      : ["26vh", "42vh", "56vh", "68vh", "78vh", "82vh"],
  );
  const venusRotate = useTransform(smoothProgress, [0, 1], [-20, 140]);

  // -------------------------------------------------------------
  // MARS ORBITAL TRAJECTORY (Pops out around scroll 0.28 -> 0.38)
  // -------------------------------------------------------------
  const marsScale = useTransform(
    smoothProgress,
    [0, 0.26, 0.34, 0.45, 0.85, 1],
    reducedMotion ? [1, 1, 1, 1, 1, 1] : [0, 0.2, 1.15, 1, 1, 0.95],
  );
  const marsOpacity = useTransform(
    smoothProgress,
    [0, 0.26, 0.33, 0.9, 1],
    reducedMotion ? [0.85, 0.85, 0.85, 0.85, 0.85] : [0, 0.15, 0.95, 0.95, 0.9],
  );
  const marsX = useTransform(
    smoothProgress,
    [0.28, 0.48, 0.68, 0.85, 1],
    reducedMotion
      ? ["65vw", "65vw", "65vw", "65vw", "65vw"]
      : ["66vw", "52vw", "72vw", "58vw", "64vw"],
  );
  const marsY = useTransform(
    smoothProgress,
    [0.28, 0.48, 0.68, 0.85, 1],
    reducedMotion
      ? ["68vh", "68vh", "68vh", "68vh", "68vh"]
      : ["36vh", "52vh", "66vh", "78vh", "85vh"],
  );
  const marsRotate = useTransform(smoothProgress, [0, 1], [15, -160]);

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none"
    >
      {/* Subtle Cosmic Orbital Ellipses */}
      <svg
        className="absolute inset-0 w-full h-full opacity-15 pointer-events-none stroke-primary/30"
        xmlns="http://www.w3.org/2000/svg"
      >
        <ellipse
          cx="65%"
          cy="52%"
          rx="52vw"
          ry="38vh"
          fill="none"
          strokeWidth="1"
          strokeDasharray="4 8"
          className="animate-[spin_240s_linear_infinite]"
        />
        <ellipse
          cx="35%"
          cy="60%"
          rx="45vw"
          ry="32vh"
          fill="none"
          strokeWidth="0.8"
          strokeDasharray="3 10"
          className="animate-[spin_180s_linear_infinite_reverse]"
        />
      </svg>

      {/* 1. EARTH GLOBE */}
      <motion.div
        style={{
          x: earthX,
          y: earthY,
          scale: earthScale,
          opacity: earthOpacity,
          rotate: earthRotate,
        }}
        className="absolute left-0 top-0 size-24 sm:size-36 md:size-44 pointer-events-none"
      >
        <CelestialPlanet
          planet={CELESTIAL_CONFIGS.earth}
          activePopoverSide="left"
          className="w-full h-full"
        />
      </motion.div>

      {/* 2. VENUS GLOBE */}
      <motion.div
        style={{
          x: venusX,
          y: venusY,
          scale: venusScale,
          opacity: venusOpacity,
          rotate: venusRotate,
        }}
        className="absolute left-0 top-0 size-20 sm:size-32 md:size-38 pointer-events-none"
      >
        <CelestialPlanet
          planet={CELESTIAL_CONFIGS.venus}
          activePopoverSide="right"
          className="w-full h-full"
        />
      </motion.div>

      {/* 3. MARS GLOBE */}
      <motion.div
        style={{
          x: marsX,
          y: marsY,
          scale: marsScale,
          opacity: marsOpacity,
          rotate: marsRotate,
        }}
        className="absolute left-0 top-0 size-18 sm:size-28 md:size-34 pointer-events-none"
      >
        <CelestialPlanet
          planet={CELESTIAL_CONFIGS.mars}
          activePopoverSide="left"
          className="w-full h-full"
        />
      </motion.div>
    </div>
  );
}
