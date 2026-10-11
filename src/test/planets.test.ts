import { describe, expect, it } from "vitest";
import { PLANETS, sidePlanets } from "@/lib/planets";

describe("planet rotation", () => {
  it("starts with Venus left and Mars right", () => {
    expect(sidePlanets("earth").map((p) => p.id)).toEqual(["venus", "mars"]);
  });
  it("always shows the other two planets and is fully reversible", () => {
    for (const id of ["earth", "venus", "mars", "earth"] as const) {
      const sides = sidePlanets(id);
      expect(sides).toHaveLength(2);
      expect(sides.some((p) => p.id === id)).toBe(false);
      expect(new Set([id, ...sides.map((p) => p.id)]).size).toBe(3);
    }
  });
  it("uses distinct hosted videos, posters and transparent artwork", () => {
    expect(new Set(PLANETS.flatMap((p) => [p.clip, p.poster, p.cutout])).size).toBe(9);
    for (const planet of PLANETS) expect(planet.clip).toContain(".mp4");
  });
});
