import { useEffect, useRef } from "react";
import { useReducedMotion } from "motion/react";

export function ScrollProductVideo({ src, label }: { src: string; label: string }) {
  const stage = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) return;
    let frame = 0;
    let visible = true;
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; });
    if (stage.current) observer.observe(stage.current);
    const tick = () => {
      const element = video.current;
      if (visible && stage.current && element && Number.isFinite(element.duration) && element.duration > 0 && !element.seeking) {
        const rect = stage.current.getBoundingClientRect();
        const progress = Math.max(0, Math.min(1, (innerHeight * .7 - rect.top) / (rect.height + innerHeight * .4)));
        const target = progress * Math.max(0, element.duration - .05);
        if (Math.abs(element.currentTime - target) > .04) element.currentTime += (target - element.currentTime) * .22;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [src, reduced]);
  return <div ref={stage} style={{ height: reduced ? "auto" : "150svh" }}>
    <video ref={video} src={src} muted playsInline preload="metadata" controls={!!reduced}
      aria-label={label} style={{ position: reduced ? "relative" : "sticky", top: "18vh", width: "100%", height: "64svh", objectFit: "contain" }} />
  </div>;
}

