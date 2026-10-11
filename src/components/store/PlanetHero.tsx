import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowDown, ArrowRight, Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { PLANETS, sidePlanets, type PlanetId } from "@/lib/planets";

export function PlanetHero() {
  const [featured, setFeatured] = useState<PlanetId>("earth");
  const [loaded, setLoaded] = useState<PlanetId[]>([]);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(true);
  const [ready, setReady] = useState(false);
  const reducedMotion = useReducedMotion();
  const section = useRef<HTMLElement>(null);
  const videos = useRef<Partial<Record<PlanetId, HTMLVideoElement>>>({});
  const planet = PLANETS.find((p) => p.id === featured) ?? PLANETS[0];
  const sides = sidePlanets(featured);

  useEffect(() => {
    setReady(true);
    const element = section.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry?.isIntersecting ?? false), { threshold: 0.05 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!ready || reducedMotion) return;
    setLoaded((current) => current.includes(featured) ? current : [...current, featured]);
  }, [featured, ready, reducedMotion]);

  useEffect(() => {
    function synchronize() {
      for (const p of PLANETS) {
        const video = videos.current[p.id];
        if (!video) continue;
        if (p.id === featured && visible && !paused && !reducedMotion && !document.hidden) {
          void video.play().catch(() => { /* The poster stays visible when autoplay is unavailable. */ });
        } else video.pause();
      }
    }
    synchronize();
    document.addEventListener("visibilitychange", synchronize);
    return () => document.removeEventListener("visibilitychange", synchronize);
  }, [featured, loaded, visible, paused, reducedMotion]);

  function warm(id: PlanetId) {
    if (!reducedMotion) setLoaded((current) => current.includes(id) ? current : [...current, id]);
  }

  const entrance = ready && !reducedMotion;
  return (
    <section ref={section} className="planet-hero" aria-label="Explore the planets">
      <div className="planet-sky" aria-hidden="true">
        {PLANETS.map((p) => (
          <div key={p.id} className={`planet-backdrop ${p.id === featured ? "is-active" : ""}`}>
            <img className="planet-poster" src={p.poster} alt="" fetchPriority={p.id === "earth" ? "high" : "auto"} />
            <video ref={(video) => { if (video) videos.current[p.id] = video; else delete videos.current[p.id]; }}
              data-planet={p.id} src={loaded.includes(p.id) ? p.clip : undefined} poster={p.poster}
              muted loop playsInline preload={p.id === featured ? "auto" : "none"} aria-hidden="true" />
          </div>
        ))}
      </div>
      <div className="planet-shade" aria-hidden="true" />
      <div className="planet-copy">
        <p className="planet-brand">OUR VISIBLE UNIVERSE <span>STORE</span></p>
        <motion.p className="planet-eyebrow" initial={false} animate={{ opacity: 1, y: 0 }} >PLANET</motion.p>
        <div className="planet-title-mask" aria-live="polite" aria-atomic="true">
          <AnimatePresence mode="sync" initial={false}>
            <motion.h1 key={planet.id} initial={entrance ? { y: "100%", opacity: 0 } : false}
              animate={{ y: 0, opacity: 1 }} exit={reducedMotion ? { opacity: 1 } : { y: "-60%", opacity: 0 }}
              transition={{ duration: reducedMotion ? 0 : 0.45, ease: [0.16, 1, 0.3, 1] }} className="planet-title">{planet.name}</motion.h1>
          </AnimatePresence>
        </div>
        <motion.div className="planet-rule" initial={false} animate={entrance ? { scaleX: [0, 1] } : { scaleX: 1 }} transition={{ duration: 0.65 }} />
        <motion.p key={planet.id} className="planet-lede" initial={entrance ? { opacity: 0, y: 12 } : false}
          animate={{ opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0 : 0.55 }}>{planet.description}</motion.p>
        <motion.div className="planet-cta" initial={false} animate={entrance ? { opacity: [0, 1], y: [8, 0] } : { opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.2 }}>
          <Link to="/shop" className={buttonVariants({ variant: "planet", size: "xl", className: "planet-shop" })}>EXPLORE THE STORE <ArrowRight /></Link>
        </motion.div>
      </div>
      <div className="planet-side-row">
        {sides.map((side, index) => (
          <Button key={index} type="button" variant="ghost" className={`planet-slot planet-slot-${index === 0 ? "left" : "right"}`}
            aria-label={`Show ${side.name}`} onClick={() => setFeatured(side.id)} onPointerEnter={() => warm(side.id)} onFocus={() => warm(side.id)}>
            <span className="planet-cutouts">
              {PLANETS.map((p) => <img key={p.id} src={p.cutout} alt="" className={p.id === side.id ? "is-shown" : ""} />)}
            </span>
            <span className="planet-slot-name">{side.name}</span>
          </Button>
        ))}
      </div>
      <Button variant="glass" size="icon" className="planet-scroll" aria-label="Explore categories"
        onClick={() => document.getElementById("categories")?.scrollIntoView({ behavior: reducedMotion ? "instant" : "smooth" })}><ArrowDown /></Button>
      {ready && !reducedMotion && <Button variant="ghost" size="icon" className="planet-playback" aria-label={paused ? "Play planet video" : "Pause planet video"}
        title={paused ? "Play planet video" : "Pause planet video"} onClick={() => setPaused((value) => !value)}>{paused ? <Play /> : <Pause />}</Button>}
    </section>
  );
}