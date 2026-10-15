import earthCutout from "@/assets/planets/earth-cutout.png.asset.json";
import venusCutout from "@/assets/planets/venus-cutout.png.asset.json";
import marsCutout from "@/assets/planets/mars-cutout.png.asset.json";

export interface MoonConfig {
  id: string;
  name: string;
  size: number; // in px on desktop
  orbitRadiusX: number; // horizontal orbit radius
  orbitRadiusY: number; // vertical tilt radius
  orbitDuration: number; // in seconds
  color: string;
  glow: string;
  textureType: "rocky" | "ice" | "cratered" | "volcanic" | "hydrocarbon";
  description: string;
}

export interface CelestialSystemConfig {
  id: string;
  categorySlugMatch: string[];
  systemName: string;
  planetName: string;
  subtitle: string;
  quote: {
    text: string;
    author: string;
  };
  coordinates: string;
  laserLabel: string;
  bodyType:
    "terrestrial" | "gas_giant" | "ice_giant" | "star" | "dwarf_binary" | "pulsar" | "asteroid";
  hasRings?: boolean;
  ringColor?: string;
  primaryColor: string;
  coronaGlow: string;
  auraSecondary: string;
  shadowColor: string;
  cutoutUrl?: string; // If an image asset is available
  textureGradient: string; // CSS radial/linear gradient simulating surface
  moons: MoonConfig[];
  telemetry: {
    classification: string;
    equatorialRadius: string;
    surfaceGravity: string;
    orbitalPeriod: string;
    atmosphereComposition: string;
    temperature: string;
    mission: string;
    astronomicalLore: string;
  };
}

export const CELESTIAL_CATALOG: CelestialSystemConfig[] = [
  // 1. Books & Field Guides -> Jupiter & Europa System
  {
    id: "jupiter-system",
    categorySlugMatch: [
      "books-guides",
      "books",
      "guides",
      "astronomy-telescopes",
      "telescopes",
      "optics",
    ],
    systemName: "Jovian System",
    planetName: "JUPITER",
    subtitle: "Lord of the Galilean Moons & Deep Space Guides",
    quote: {
      text: "The cosmos is within us. We are made of star-stuff.",
      author: "Carl Sagan",
    },
    coordinates: "RA 17h 52m 14s · DEC -23° 24′ 12″ · JOVIAN SECTOR",
    laserLabel: "JOVIAN KNOWLEDGE & OBSERVATION AXIS",
    bodyType: "gas_giant",
    hasRings: false,
    primaryColor: "#f59e0b",
    coronaGlow: "rgba(245, 158, 11, 0.45)",
    auraSecondary: "rgba(217, 119, 6, 0.35)",
    shadowColor: "rgba(120, 53, 15, 0.8)",
    textureGradient:
      "radial-gradient(circle at 35% 35%, #fef3c7 0%, #fde68a 18%, #f59e0b 38%, #d97706 58%, #b45309 78%, #78350f 100%)",
    moons: [
      {
        id: "europa",
        name: "Europa",
        size: 30,
        orbitRadiusX: 130,
        orbitRadiusY: 42,
        orbitDuration: 18,
        color: "#e0f2fe",
        glow: "rgba(56, 189, 248, 0.7)",
        textureType: "ice",
        description: "Smooth ice crust concealing an ocean twice the volume of Earth's.",
      },
      {
        id: "io",
        name: "Io",
        size: 24,
        orbitRadiusX: 95,
        orbitRadiusY: 30,
        orbitDuration: 12,
        color: "#fef08a",
        glow: "rgba(234, 179, 8, 0.7)",
        textureType: "volcanic",
        description:
          "Most geologically active body in the Solar System with 400+ erupting volcanoes.",
      },
    ],
    telemetry: {
      classification: "Gas Giant · Jovian Class I",
      equatorialRadius: "71,492 km (11.2× Earth)",
      surfaceGravity: "24.79 m/s² (2.53 g)",
      orbitalPeriod: "11.86 Earth years",
      atmosphereComposition: "89% H₂, 10% He, traces of CH₄, NH₃",
      temperature: "-110 °C (cloud tops)",
      mission: "Juno & Galileo Orbiter",
      astronomicalLore:
        "The gravitational sentinel of our solar system, whose massive lens and turbulent belts inspire generations of telescopic exploration.",
    },
  },

  // 2. Space Party Supplies -> Saturn & Titan System
  {
    id: "saturn-system",
    categorySlugMatch: ["space-party-supplies", "space-b-day-party", "party", "space-party"],
    systemName: "Cronian System",
    planetName: "SATURN",
    subtitle: "Crown Jewel of Cosmic Celebrations",
    quote: {
      text: "The universe is under no obligation to make sense to you.",
      author: "Neil deGrasse Tyson",
    },
    coordinates: "RA 21h 32m 40s · DEC -15° 48′ 21″ · CRONIAN RING PLANE",
    laserLabel: "CRONIAN CELEBRATION RING PLANE",
    bodyType: "gas_giant",
    hasRings: true,
    ringColor:
      "linear-gradient(90deg, rgba(234,179,8,0) 0%, rgba(254,240,138,0.85) 30%, rgba(202,138,4,0.3) 50%, rgba(253,224,71,0.9) 70%, rgba(234,179,8,0) 100%)",
    primaryColor: "#eab308",
    coronaGlow: "rgba(234, 179, 8, 0.4)",
    auraSecondary: "rgba(253, 224, 71, 0.3)",
    shadowColor: "rgba(113, 63, 18, 0.75)",
    textureGradient:
      "radial-gradient(circle at 38% 34%, #fef9c3 0%, #fef08a 22%, #eab308 45%, #ca8a04 68%, #854d0e 90%, #422006 100%)",
    moons: [
      {
        id: "titan",
        name: "Titan",
        size: 34,
        orbitRadiusX: 145,
        orbitRadiusY: 46,
        orbitDuration: 22,
        color: "#fdba74",
        glow: "rgba(249, 115, 22, 0.65)",
        textureType: "hydrocarbon",
        description: "Only moon with a dense nitrogen atmosphere and liquid methane lakes.",
      },
      {
        id: "enceladus",
        name: "Enceladus",
        size: 20,
        orbitRadiusX: 110,
        orbitRadiusY: 34,
        orbitDuration: 14,
        color: "#f8fafc",
        glow: "rgba(226, 232, 240, 0.8)",
        textureType: "ice",
        description: "Pure water ice moon erupting cryovolcanic plumes into Saturn's E-ring.",
      },
    ],
    telemetry: {
      classification: "Ringed Gas Giant · Chromatic Gold",
      equatorialRadius: "58,232 km (9.45× Earth)",
      surfaceGravity: "10.44 m/s² (1.06 g)",
      orbitalPeriod: "29.45 Earth years",
      atmosphereComposition: "96% H₂, 3% He, 0.4% CH₄",
      temperature: "-140 °C (1 bar level)",
      mission: "Cassini-Huygens Mission",
      astronomicalLore:
        "Surrounded by billions of ice particles spinning in millimeter-thin orbital rings, Saturn exemplifies cosmic precision and celebratory wonder.",
    },
  },

  // 3. Space Décor & Showpieces -> Earth & Luna System
  {
    id: "earth-system",
    categorySlugMatch: ["space-decor", "showpieces", "decor", "solar-system"],
    systemName: "Terran System",
    planetName: "EARTH & LUNA",
    subtitle: "The Pale Blue Oasis of Cosmic Décor",
    quote: {
      text: "Look again at that dot. That's here. That's home. That's us.",
      author: "Carl Sagan",
    },
    coordinates: "RA 00h 00m 00s · DEC +00° 00′ 00″ · TERRAN HORIZON",
    laserLabel: "TERRAN ORBITAL & DÉCOR INTERIOR",
    bodyType: "terrestrial",
    hasRings: false,
    primaryColor: "#38bdf8",
    coronaGlow: "rgba(56, 189, 248, 0.45)",
    auraSecondary: "rgba(14, 165, 233, 0.35)",
    shadowColor: "rgba(12, 74, 110, 0.8)",
    cutoutUrl: earthCutout.url,
    textureGradient:
      "radial-gradient(circle at 35% 35%, #7dd3fc 0%, #38bdf8 30%, #0284c7 60%, #0369a1 85%, #082f49 100%)",
    moons: [
      {
        id: "luna",
        name: "Luna (The Moon)",
        size: 32,
        orbitRadiusX: 125,
        orbitRadiusY: 40,
        orbitDuration: 20,
        color: "#cbd5e1",
        glow: "rgba(203, 213, 225, 0.7)",
        textureType: "cratered",
        description: "Our celestial companion, covered in basalt maria and Tycho impact ejecta.",
      },
    ],
    telemetry: {
      classification: "Terrestrial Habitable · Class M",
      equatorialRadius: "6,378 km (1.00× Earth)",
      surfaceGravity: "9.807 m/s² (1.00 g)",
      orbitalPeriod: "365.25 days (1.00 AU)",
      atmosphereComposition: "78.08% N₂, 20.95% O₂, 0.93% Ar",
      temperature: "15 °C (mean surface)",
      mission: "Apollo, ISS & Artemis Program",
      astronomicalLore:
        "The cradle of humanity and visible cosmology, adorned with swirling sapphire oceans and illuminated by lunar regolith.",
    },
  },

  // 4. Clocks & Timepieces -> Neptune & Triton System
  {
    id: "neptune-system",
    categorySlugMatch: ["clocks-timepieces", "clock", "clocks", "timepieces", "astronomy-apparel"],
    systemName: "Poseidonian System",
    planetName: "NEPTUNE",
    subtitle: "Deep Voyager Ultramarine & Precision Orbital Cycles",
    quote: {
      text: "Somewhere, something incredible is waiting to be known.",
      author: "Carl Sagan",
    },
    coordinates: "RA 23h 34m 58s · DEC -04° 12′ 33″ · POSEIDONIAN REALM",
    laserLabel: "DEEP VOYAGER CHRONOLOGY VECTOR",
    bodyType: "ice_giant",
    hasRings: false,
    primaryColor: "#0284c7",
    coronaGlow: "rgba(2, 132, 199, 0.5)",
    auraSecondary: "rgba(6, 182, 212, 0.35)",
    shadowColor: "rgba(8, 47, 73, 0.85)",
    textureGradient:
      "radial-gradient(circle at 35% 35%, #67e8f9 0%, #38bdf8 25%, #0284c7 55%, #0369a1 80%, #0c4a6e 100%)",
    moons: [
      {
        id: "triton",
        name: "Triton",
        size: 28,
        orbitRadiusX: 120,
        orbitRadiusY: 38,
        orbitDuration: 16,
        color: "#a5f3fc",
        glow: "rgba(34, 211, 238, 0.65)",
        textureType: "ice",
        description:
          "Retrograde captured Kuiper world erupting liquid nitrogen geysers into thin cantaloupe terrain.",
      },
    ],
    telemetry: {
      classification: "Ice Giant · Deep Azure Cryosphere",
      equatorialRadius: "24,764 km (3.88× Earth)",
      surfaceGravity: "11.15 m/s² (1.14 g)",
      orbitalPeriod: "164.8 Earth years",
      atmosphereComposition: "80% H₂, 19% He, 1.5% CH₄",
      temperature: "-201 °C (cloud deck)",
      mission: "Voyager 2 Planetary Flyby",
      astronomicalLore:
        "Whipped by supersonic equatorial winds exceeding 2,100 km/h, Neptune wraps itself in vivid methane clouds of sublime elegance.",
    },
  },

  // 5. Cosmic Lighting & Projectors -> Helios & Mercury System
  {
    id: "sun-system",
    categorySlugMatch: ["cosmic-lighting", "lamp", "lights", "lighting", "projectors"],
    systemName: "Heliosphere",
    planetName: "THE SUN & MERCURY",
    subtitle: "The Primordial Furnace of Visible Illumination",
    quote: {
      text: "Equipped with his senses, man explores the universe and calls the adventure Science.",
      author: "Edwin Hubble",
    },
    coordinates: "SOLAR APEX · 1.00 AU · SPECTRAL CLASS G2V",
    laserLabel: "PHOTOSPHERIC RADIANCE & LIGHTING AXIS",
    bodyType: "star",
    hasRings: false,
    primaryColor: "#f97316",
    coronaGlow: "rgba(249, 115, 22, 0.55)",
    auraSecondary: "rgba(251, 191, 36, 0.45)",
    shadowColor: "rgba(124, 45, 18, 0.8)",
    cutoutUrl: venusCutout.url,
    textureGradient:
      "radial-gradient(circle at 35% 35%, #fffbeb 0%, #fef08a 20%, #facc15 40%, #f97316 65%, #ea580c 85%, #9a3412 100%)",
    moons: [
      {
        id: "mercury",
        name: "Mercury",
        size: 22,
        orbitRadiusX: 115,
        orbitRadiusY: 36,
        orbitDuration: 13,
        color: "#94a3b8",
        glow: "rgba(251, 191, 36, 0.6)",
        textureType: "cratered",
        description:
          "Sun-scorched iron-core world enduring intense solar radiation and temperature extremes.",
      },
    ],
    telemetry: {
      classification: "Yellow Dwarf Star · Spectral Class G2V",
      equatorialRadius: "696,340 km (109× Earth)",
      surfaceGravity: "274 m/s² (28.0 g)",
      orbitalPeriod: "230 Million Year Galactic Orbit",
      atmosphereComposition: "73.4% Hydrogen, 25.0% Helium, 0.9% Oxygen",
      temperature: "5,500 °C (Photosphere) / 1.5M °C (Corona)",
      mission: "Parker Solar Probe & SOHO",
      astronomicalLore:
        "The celestial dynamo sustaining life and vision across our visible realm, bathing the planets in perpetual radiant energy.",
    },
  },

  // 6. Educational & Science -> Mars & Phobos System
  {
    id: "mars-system",
    categorySlugMatch: ["educational-science", "science"],
    systemName: "Aresian System",
    planetName: "MARS & PHOBOS",
    subtitle: "The Red Frontier of Science",
    quote: {
      text: "The iron in our blood was forged in the hearts of dying stars.",
      author: "Carl Sagan",
    },
    coordinates: "RA 05h 12m 18s · DEC +24° 31′ 09″ · ARESIAN FRONTIER",
    laserLabel: "ARESIAN LABORATORY TRANSECT",
    bodyType: "terrestrial",
    hasRings: false,
    primaryColor: "#ef4444",
    coronaGlow: "rgba(239, 68, 68, 0.45)",
    auraSecondary: "rgba(249, 115, 22, 0.35)",
    shadowColor: "rgba(127, 29, 29, 0.8)",
    cutoutUrl: marsCutout.url,
    textureGradient:
      "radial-gradient(circle at 35% 35%, #fecaca 0%, #f87171 25%, #ef4444 55%, #dc2626 78%, #7f1d1d 100%)",
    moons: [
      {
        id: "phobos",
        name: "Phobos",
        size: 22,
        orbitRadiusX: 105,
        orbitRadiusY: 34,
        orbitDuration: 11,
        color: "#a8a29e",
        glow: "rgba(239, 68, 68, 0.6)",
        textureType: "rocky",
        description: "Grooved asteroid moon orbiting just 6,000 km above the Martian crust.",
      },
    ],
    telemetry: {
      classification: "Terrestrial Desert · Iron Oxide Crust",
      equatorialRadius: "3,396 km (0.53× Earth)",
      surfaceGravity: "3.721 m/s² (0.38 g)",
      orbitalPeriod: "687 Earth days (1.52 AU)",
      atmosphereComposition: "95.3% CO₂, 2.6% N₂, 1.9% Ar",
      temperature: "-60 °C (average surface)",
      mission: "Perseverance & Curiosity Mars Rovers",
      astronomicalLore:
        "Home to towering shield volcano Olympus Mons and the ancient fluvial deltas where humanity searches for the origins of life.",
    },
  },

  // 7. Astronomy Gifts -> Uranus & Titania System
  // 7. Astronomy Gifts & Keepsakes -> Uranus & Titania System
  {
    id: "uranus-system",
    categorySlugMatch: ["astronomy-gifts", "gifts", "keepsakes"],
    systemName: "Uranian System",
    planetName: "URANUS",
    subtitle: "The Tilted Aquamarine Sphere of Keepsakes",
    quote: {
      text: "For my part I know nothing with any certainty, but the sight of the stars makes me dream.",
      author: "Vincent van Gogh",
    },
    coordinates: "RA 03h 02m 10s · DEC +17° 14′ 45″ · URANIAN OBLIQUITY",
    laserLabel: "AQUAMARINE KEEPSAKE SPHERE TILT",
    bodyType: "ice_giant",
    hasRings: true,
    ringColor:
      "linear-gradient(90deg, rgba(6,182,212,0) 0%, rgba(103,232,249,0.7) 40%, rgba(6,182,212,0.85) 60%, rgba(6,182,212,0) 100%)",
    primaryColor: "#06b6d4",
    coronaGlow: "rgba(6, 182, 212, 0.45)",
    auraSecondary: "rgba(20, 184, 166, 0.35)",
    shadowColor: "rgba(19, 78, 74, 0.8)",
    textureGradient:
      "radial-gradient(circle at 35% 35%, #cffafe 0%, #a5f3fc 25%, #22d3ee 55%, #0891b2 80%, #164e63 100%)",
    moons: [
      {
        id: "titania",
        name: "Titania",
        size: 26,
        orbitRadiusX: 120,
        orbitRadiusY: 38,
        orbitDuration: 17,
        color: "#e2e8f0",
        glow: "rgba(6, 182, 212, 0.6)",
        textureType: "ice",
        description:
          "Largest moon of Uranus with massive tectonic rift valleys stretching hundreds of kilometers.",
      },
    ],
    telemetry: {
      classification: "Tilted Ice Giant · Aquamarine",
      equatorialRadius: "25,362 km (3.98× Earth)",
      surfaceGravity: "8.69 m/s² (0.89 g)",
      orbitalPeriod: "84.0 Earth years",
      atmosphereComposition: "83% H₂, 15% He, 2.3% CH₄",
      temperature: "-224 °C (Coldest planetary atmosphere)",
      mission: "Voyager 2 Planetary Flyby",
      astronomicalLore:
        "Tilted 98 degrees on its axis, Uranus rolls through the cosmos like a polished aquamarine sphere, offering rare ethereal beauty.",
    },
  },

  // 8. Kids & STEM Learning -> Pluto & Charon Binary System
  {
    id: "pluto-system",
    categorySlugMatch: ["kids-learning", "kids", "stem", "learning"],
    systemName: "Kuiper Binary System",
    planetName: "PLUTO & CHARON",
    subtitle: "The Nitrogen Heart of Young Explorers",
    quote: {
      text: "Remember to look up at the stars and not down at your feet.",
      author: "Stephen Hawking",
    },
    coordinates: "RA 19h 58m 22s · DEC -22° 11′ 05″ · KUIPER BINARY",
    laserLabel: "TOMBAUGH STEM EXPLORATION SECTOR",
    bodyType: "dwarf_binary",
    hasRings: false,
    primaryColor: "#c084fc",
    coronaGlow: "rgba(192, 132, 252, 0.45)",
    auraSecondary: "rgba(232, 121, 249, 0.35)",
    shadowColor: "rgba(88, 28, 135, 0.8)",
    textureGradient:
      "radial-gradient(circle at 35% 35%, #f5d0fe 0%, #e879f9 25%, #c084fc 55%, #9333ea 80%, #581c87 100%)",
    moons: [
      {
        id: "charon",
        name: "Charon",
        size: 28,
        orbitRadiusX: 100,
        orbitRadiusY: 32,
        orbitDuration: 14,
        color: "#cbd5e1",
        glow: "rgba(192, 132, 252, 0.65)",
        textureType: "cratered",
        description:
          "Tidally locked binary partner featuring reddish tholin-capped northern pole (Mordor Macula).",
      },
    ],
    telemetry: {
      classification: "Kuiper Belt Dwarf Binary · Tombaugh Regio",
      equatorialRadius: "1,188 km (0.19× Earth)",
      surfaceGravity: "0.62 m/s² (0.063 g)",
      orbitalPeriod: "248.0 Earth years",
      atmosphereComposition: "99% N₂, traces of CH₄, CO",
      temperature: "-230 °C (nitrogen ice glaciers)",
      mission: "New Horizons Kuiper Flyby",
      astronomicalLore:
        "Featuring the giant heart-shaped nitrogen glacier of Sputnik Planitia, Pluto inspires wonder in students and young explorers.",
    },
  },

  // 9. Space Wall Art & Posters -> Stellar Pulsar Core System
  {
    id: "pulsar-system",
    categorySlugMatch: [
      "space-wall-art",
      "spaceart",
      "art",
      "posters",
      "wall-art",
      "galaxy-nebula",
    ],
    systemName: "Orion Stellar Nursery",
    planetName: "PULSAR CORE",
    subtitle: "Relativistic Light Beacon of Celestial Wall Art",
    quote: {
      text: "We are a way for the cosmos to know itself.",
      author: "Carl Sagan",
    },
    coordinates: "RA 05h 35m 17s · DEC -05° 23′ 28″ · ORION NEBULA CORE",
    laserLabel: "RELATIVISTIC ART & NEBULA EMISSION",
    bodyType: "pulsar",
    hasRings: true,
    ringColor:
      "linear-gradient(90deg, rgba(168,85,247,0) 0%, rgba(217,70,239,0.9) 35%, rgba(6,182,212,0.85) 65%, rgba(168,85,247,0) 100%)",
    primaryColor: "#a855f7",
    coronaGlow: "rgba(168, 85, 247, 0.55)",
    auraSecondary: "rgba(6, 182, 212, 0.4)",
    shadowColor: "rgba(59, 7, 100, 0.85)",
    textureGradient:
      "radial-gradient(circle at 35% 35%, #ffffff 0%, #e9d5ff 20%, #c084fc 45%, #9333ea 70%, #581c87 90%, #2e1065 100%)",
    moons: [
      {
        id: "proplyd",
        name: "Proplyd Core",
        size: 22,
        orbitRadiusX: 110,
        orbitRadiusY: 35,
        orbitDuration: 10,
        color: "#67e8f9",
        glow: "rgba(6, 182, 212, 0.75)",
        textureType: "hydrocarbon",
        description:
          "Ionized protoplanetary disc harboring embryonic planetesimals in the Great Nebula.",
      },
    ],
    telemetry: {
      classification: "Neutron Star Pulsar · Emission Nebula Core",
      equatorialRadius: "12 km (Extreme Stellar Density)",
      surfaceGravity: "2.0 × 10¹² m/s²",
      orbitalPeriod: "33.2 Millisecond Spin Period",
      atmosphereComposition: "Relativistic electron-positron plasma",
      temperature: "1,000,000 K (surface)",
      mission: "James Webb NIRCam & Chandra X-Ray",
      astronomicalLore:
        "Spinning at tens of times per second and projecting relativistic beams of electromagnetic radiation across interstellar space.",
    },
  },

  // 10. Tech & Daily Accessories -> Ceres & Asteroid Belt
  {
    id: "ceres-system",
    categorySlugMatch: [
      "tech-accessories",
      "mobile-accessories",
      "space-accessories",
      "accessories",
      "space-gadgets",
      "gadgets",
    ],
    systemName: "Main Belt Protoplanet",
    planetName: "CERES & VESTA",
    subtitle: "Keepers of Everyday Space Instrumentation",
    quote: {
      text: "Not only are we in the universe, the universe is in us.",
      author: "Neil deGrasse Tyson",
    },
    coordinates: "RA 14h 22m 38s · DEC +11° 18′ 44″ · MAIN ASTEROID BELT",
    laserLabel: "TECH & DAILY INSTRUMENTATION VECTOR",
    bodyType: "asteroid",
    hasRings: false,
    primaryColor: "#94a3b8",
    coronaGlow: "rgba(148, 163, 184, 0.45)",
    auraSecondary: "rgba(100, 116, 139, 0.35)",
    shadowColor: "rgba(30, 41, 59, 0.8)",
    textureGradient:
      "radial-gradient(circle at 35% 35%, #f1f5f9 0%, #cbd5e1 30%, #94a3b8 60%, #64748b 85%, #334155 100%)",
    moons: [
      {
        id: "vesta",
        name: "Vesta",
        size: 24,
        orbitRadiusX: 115,
        orbitRadiusY: 36,
        orbitDuration: 15,
        color: "#cbd5e1",
        glow: "rgba(148, 163, 184, 0.65)",
        textureType: "rocky",
        description:
          "Differentiated protoplanet featuring massive southern impact crater Rheasilvia.",
      },
    ],
    telemetry: {
      classification: "Main Belt Protoplanet · Carbonaceous Chondrite",
      equatorialRadius: "469 km (0.073× Earth)",
      surfaceGravity: "0.28 m/s² (0.029 g)",
      orbitalPeriod: "4.60 Earth years",
      atmosphereComposition: "Transient water-vapor exosphere",
      temperature: "-106 °C (mean surface)",
      mission: "Dawn Ion-Propelled Spacecraft",
      astronomicalLore:
        "Harboring luminous carbonate salt deposits in Occator Crater, Ceres is a bridge between the rocky inner worlds and outer gas giants.",
    },
  },
];

// Fallback exoplanet configuration for any unmapped category
export const DEFAULT_CELESTIAL_SYSTEM: CelestialSystemConfig = {
  id: "kepler-system",
  categorySlugMatch: [],
  systemName: "Kepler Exoplanetary System",
  planetName: "KEPLER-452B",
  subtitle: "Cousin of the Visible World",
  quote: {
    text: "Across the sea of space, the stars are other suns.",
    author: "Carl Sagan",
  },
  coordinates: "RA 19h 44m 00s · DEC +44° 16′ 39″ · KEPLER HABITABLE ZONE",
  laserLabel: "EXOPLANETARY VECTOR",
  bodyType: "terrestrial",
  hasRings: true,
  ringColor:
    "linear-gradient(90deg, rgba(14,165,233,0) 0%, rgba(56,189,248,0.7) 40%, rgba(14,165,233,0.8) 60%, rgba(14,165,233,0) 100%)",
  primaryColor: "#0ea5e9",
  coronaGlow: "rgba(14, 165, 233, 0.45)",
  auraSecondary: "rgba(56, 189, 248, 0.35)",
  shadowColor: "rgba(12, 74, 110, 0.8)",
  textureGradient:
    "radial-gradient(circle at 35% 35%, #bae6fd 0%, #38bdf8 30%, #0284c7 60%, #0369a1 85%, #082f49 100%)",
  moons: [
    {
      id: "exomoon-a",
      name: "Aethelgard",
      size: 26,
      orbitRadiusX: 120,
      orbitRadiusY: 38,
      orbitDuration: 18,
      color: "#fde047",
      glow: "rgba(250, 204, 21, 0.65)",
      textureType: "rocky",
      description:
        "Tidally warmed exomoon bathed in the golden radiation of a G2-type parent star.",
    },
  ],
  telemetry: {
    classification: "Super-Earth · Habitable Zone Exoplanet",
    equatorialRadius: "9,600 km (1.63× Earth)",
    surfaceGravity: "19.6 m/s² (2.0 g)",
    orbitalPeriod: "384.8 Earth days (1.05 AU)",
    atmosphereComposition: "Thick volcanic atmosphere with dense cloud decks",
    temperature: "-8 °C (equilibrium estimate)",
    mission: "Kepler Space Telescope & Habitable Worlds Obs",
    astronomicalLore:
      "A super-Earth orbiting within the habitable zone of a solar twin, 1,402 light-years distant in the Cygnus celestial sector.",
  },
};

export function getCelestialSystemForCategory(slug: string): CelestialSystemConfig {
  const normalized = (slug || "").toLowerCase().trim();
  // 1. Prioritize exact slug match
  const exact = CELESTIAL_CATALOG.find((sys) =>
    sys.categorySlugMatch.some((matchSlug) => normalized === matchSlug),
  );
  if (exact) return exact;

  // 2. Substring matching
  const match = CELESTIAL_CATALOG.find((sys) =>
    sys.categorySlugMatch.some(
      (matchSlug) => normalized.includes(matchSlug) || matchSlug.includes(normalized),
    ),
  );
  return match ?? DEFAULT_CELESTIAL_SYSTEM;
}
