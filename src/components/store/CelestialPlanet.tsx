import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "motion/react";
import { ArrowRight, Compass, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PlanetTelemetry {
  distanceAU: string;
  atmosphere: string;
  curatedTheme: string;
  query: string;
}

export interface CelestialPlanetConfig {
  id: "earth" | "venus" | "mars";
  name: string;
  cutout: string;
  auraColor: string;
  rimColor: string;
  shadowColor: string;
  telemetry: PlanetTelemetry;
  description: string;
}

interface CelestialPlanetProps {
  planet: CelestialPlanetConfig;
  className?: string;
  activePopoverSide?: "left" | "right" | "top" | "bottom";
}

export function CelestialPlanet({
  planet,
  className,
  activePopoverSide = "left",
}: CelestialPlanetProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const showTelemetry = isHovered || isFocused;

  return (
    <div
      className={cn("relative group select-none pointer-events-auto", className)}
      onPointerEnter={() => setIsHovered(true)}
      onPointerLeave={() => setIsHovered(false)}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
    >
      {/* Outer Atmospheric Corona Glow */}
      <div
        aria-hidden="true"
        className={cn(
          "absolute inset-0 rounded-full blur-2xl transition-all duration-700 pointer-events-none",
          isHovered ? "opacity-100 scale-135" : "opacity-60 scale-110",
        )}
        style={{
          background: `radial-gradient(circle, ${planet.auraColor} 0%, ${planet.rimColor} 45%, transparent 75%)`,
        }}
      />

      {/* Main Interactive Planet Globe Link */}
      <Link
        to="/search"
        search={{ q: planet.telemetry.query }}
        aria-label={`Explore ${planet.name} collection: ${planet.telemetry.curatedTheme}`}
        className="relative block rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/80"
      >
        <div
          className={cn(
            "relative aspect-square w-full h-full rounded-full overflow-hidden transition-transform duration-500 ease-out",
            isHovered && "scale-108",
          )}
          style={{
            boxShadow: `0 0 35px -5px ${planet.auraColor}, inset 0 0 20px -2px ${planet.rimColor}`,
          }}
        >
          {/* Planet Cutout Texture with continuous axial rotation */}
          <img
            src={planet.cutout}
            alt=""
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover rounded-full pointer-events-none animate-[spin_120s_linear_infinite]"
          />

          {/* 3D Spherical Day-to-Night Terminator & Limb Shadow */}
          <div
            aria-hidden="true"
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              background: `radial-gradient(circle at 35% 32%, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.02) 42%, ${planet.shadowColor} 88%, rgba(2,4,12,0.95) 100%)`,
              mixBlendMode: "multiply",
            }}
          />

          {/* Glowing Atmospheric Rim Edge */}
          <div
            aria-hidden="true"
            className={cn(
              "absolute inset-0 rounded-full pointer-events-none border transition-opacity duration-500",
              isHovered ? "opacity-100" : "opacity-75",
            )}
            style={{
              borderColor: planet.rimColor,
              boxShadow: `inset 3px 3px 12px ${planet.rimColor}, inset -8px -8px 18px rgba(0,0,0,0.85)`,
            }}
          />
        </div>
      </Link>

      {/* Telemetry Hover Card */}
      <AnimatePresence>
        {showTelemetry && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 6 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className={cn(
              "absolute z-50 w-64 sm:w-72 p-3.5 sm:p-4 rounded-2xl glass-dark border border-primary/30 backdrop-blur-xl shadow-2xl pointer-events-auto",
              activePopoverSide === "left" && "right-full mr-4 top-1/2 -translate-y-1/2",
              activePopoverSide === "right" && "left-full ml-4 top-1/2 -translate-y-1/2",
              activePopoverSide === "top" && "bottom-full mb-4 left-1/2 -translate-x-1/2",
              activePopoverSide === "bottom" && "top-full mt-4 left-1/2 -translate-x-1/2",
            )}
          >
            {/* Header info */}
            <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-2">
              <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-primary">
                <Sparkles className="size-3 text-primary animate-pulse" />
                Sector {planet.name}
              </span>
              <span className="font-mono text-[9px] text-muted-foreground">
                {planet.telemetry.distanceAU}
              </span>
            </div>

            {/* Title & Collection focus */}
            <div className="mt-2.5">
              <h4 className="font-display text-lg font-semibold text-foreground leading-tight">
                {planet.name}
              </h4>
              <p className="mt-0.5 font-mono text-[11px] text-accent font-medium">
                {planet.telemetry.curatedTheme}
              </p>
              <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed line-clamp-2">
                {planet.description}
              </p>
            </div>

            {/* Quick Link Action */}
            <div className="mt-3 pt-2 border-t border-border/30 flex items-center justify-between">
              <span className="font-mono text-[9px] text-muted-foreground flex items-center gap-1">
                <Compass className="size-3" />
                {planet.telemetry.atmosphere}
              </span>
              <Link
                to="/search"
                search={{ q: planet.telemetry.query }}
                className="inline-flex items-center gap-1 rounded-full bg-primary/20 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/30 transition-colors"
              >
                <span>View theme</span>
                <ArrowRight className="size-3" />
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
