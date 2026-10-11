import { cn } from "@/lib/utils";

interface SpaceLaserLineProps {
  label?: string;
  coordinates?: string;
  className?: string;
}

export function SpaceLaserLine({
  label = "CELESTIAL SURVEY",
  coordinates = "RA 12h 45m 22s · DEC +14° 19′ 40″ · EPOCH J2000",
  className,
}: SpaceLaserLineProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative my-8 sm:my-12 flex flex-col items-center justify-center select-none",
        className,
      )}
    >
      {/* GLOWING LASER BEAM */}
      <div className="relative w-full flex items-center justify-center">
        {/* Soft background pulse */}
        <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-primary/30 to-transparent blur-sm" />
        {/* Core sharp laser beam */}
        <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-primary/80 to-transparent" />

        {/* Center coordinate beacon */}
        <div className="absolute flex items-center justify-center">
          <div className="size-2 rounded-full bg-primary shadow-[0_0_12px_rgba(168,85,247,0.8)]" />
          <div className="absolute size-4 rounded-full border border-primary/40 animate-ping" />
        </div>
      </div>

      {/* MINIMALIST TICK MARKS & CELESTIAL METADATA */}
      <div className="mt-2.5 flex items-center justify-between w-full max-w-4xl px-4 text-[9px] sm:text-[10px] font-mono tracking-widest text-muted-foreground/75 uppercase">
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-1 rounded-full bg-primary/60" />
          <span>{label}</span>
        </span>
        <span className="hidden sm:inline-block tracking-widest text-muted-foreground/60">
          {coordinates}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="text-primary/70">ORBIT 360°</span>
          <span className="inline-block size-1 rounded-full bg-primary/60" />
        </span>
      </div>
    </div>
  );
}
