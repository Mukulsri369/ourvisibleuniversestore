import { motion, useReducedMotion } from "motion/react";
import { ArrowDown, ArrowRight } from "lucide-react";
import { useRef } from "react";
import { buttonVariants } from "@/components/ui/button";
import { EarthModelViewer } from "./EarthModelViewer";

export function PlanetHero() {
  const reducedMotion = useReducedMotion();
  const section = useRef<HTMLElement>(null);




  return (
    <section ref={section} className="planet-hero" aria-label="Explore the universe">
<div className="hero-orbit hero-orbit-one" aria-hidden="true" />
<div className="planet-shade" aria-hidden="true" />
      <motion.div className="earth-stage"><EarthModelViewer /></motion.div>
      <motion.div
        className="planet-copy"
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reducedMotion ? 0 : 0.8, ease: [0.16, 1, 0.3, 1] }}
      >
<div className="planet-title-mask">
          <h1 className="planet-title">Wonder, closer.</h1>
        </div>

        <p className="planet-lede">
          Astronomy gifts, space gear, and objects for a life inspired by the universe.
        </p>
        <div className="planet-cta">
          <a
            href="#featured-collection"
            onClick={(event) => {
              const target = document.getElementById("featured-collection") || document.getElementById("featured-products");
              if (!target) return;
              event.preventDefault();
              target.scrollIntoView({ behavior: reducedMotion ? "instant" : "smooth", block: "start" });
            }}
            className={buttonVariants({ variant: "planet", size: "xl", className: "planet-shop" })}
          >
            Explore collection <ArrowRight />
          </a>
        </div>
      </motion.div>
      <button
        type="button"
        className="planet-scroll"
        aria-label="Explore products"
        onClick={() => {
          const target =
            document.getElementById("festival-special") ||
            document.getElementById("featured-products") ||
            document.getElementById("store-content") ||
            document.getElementById("categories");
          target?.scrollIntoView({ behavior: reducedMotion ? "instant" : "smooth" });
        }}
      >
        <ArrowDown />
      </button>
    </section>
  );
}
