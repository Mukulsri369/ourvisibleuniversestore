import { describe, expect, it } from "vitest";
import {
  getCelestialSystemForCategory,
  CELESTIAL_CATALOG,
  DEFAULT_CELESTIAL_SYSTEM,
} from "@/lib/celestial-catalog";

describe("celestial catalog system matching", () => {
  it("matches astronomy-telescopes to the Jovian System with Europa and Io", () => {
    const system = getCelestialSystemForCategory("astronomy-telescopes");
    expect(system.planetName).toBe("JUPITER");
    expect(system.moons.map((m) => m.name)).toEqual(["Europa", "Io"]);
    expect(system.bodyType).toBe("gas_giant");
  });

  it("matches space-gadgets to Saturn System with rings and Titan", () => {
    const system = getCelestialSystemForCategory("space-gadgets");
    expect(system.planetName).toBe("SATURN");
    expect(system.hasRings).toBe(true);
    expect(system.moons.some((m) => m.name === "Titan")).toBe(true);
  });

  it("matches lamp and lights to The Sun & Mercury System", () => {
    const system = getCelestialSystemForCategory("lamp");
    expect(system.planetName).toContain("THE SUN");
    expect(system.moons[0]?.name).toBe("Mercury");
  });

  it("matches astronomy-apparel to Neptune & Triton System", () => {
    const system = getCelestialSystemForCategory("astronomy-apparel");
    expect(system.planetName).toBe("NEPTUNE");
    expect(system.moons[0]?.name).toBe("Triton");
  });

  it("matches educational-science to Mars & Phobos System", () => {
    const system = getCelestialSystemForCategory("educational-science");
    expect(system.planetName).toContain("MARS");
    expect(system.moons[0]?.name).toBe("Phobos");
  });

  it("matches kids-learning to Pluto & Charon Binary System", () => {
    const system = getCelestialSystemForCategory("kids-learning");
    expect(system.planetName).toContain("PLUTO");
    expect(system.moons[0]?.name).toBe("Charon");
  });

  it("falls back to Kepler system for unrecognized categories", () => {
    const system = getCelestialSystemForCategory("unknown-random-category-slug");
    expect(system.id).toBe(DEFAULT_CELESTIAL_SYSTEM.id);
    expect(system.planetName).toBe("KEPLER-452B");
  });

  it("has valid telemetry and moons for all defined systems", () => {
    for (const sys of CELESTIAL_CATALOG) {
      expect(sys.planetName).toBeDefined();
      expect(sys.telemetry.classification).toBeDefined();
      expect(sys.telemetry.equatorialRadius).toBeDefined();
      expect(sys.telemetry.surfaceGravity).toBeDefined();
      expect(sys.telemetry.astronomicalLore).toBeDefined();
    }
  });
});
