import earthClip from "@/assets/planets/earth-video.mp4.asset.json";
import venusClip from "@/assets/planets/venus-video.mp4.asset.json";
import marsClip from "@/assets/planets/mars-video.mp4.asset.json";
import earthPoster from "@/assets/planets/earth-poster.png.asset.json";
import venusPoster from "@/assets/planets/venus-poster.png.asset.json";
import marsPoster from "@/assets/planets/mars-poster.png.asset.json";
import earthCutout from "@/assets/planets/earth-cutout.png.asset.json";
import venusCutout from "@/assets/planets/venus-cutout.png.asset.json";
import marsCutout from "@/assets/planets/mars-cutout.png.asset.json";

export const PLANETS = [
  {
    id: "earth",
    name: "EARTH",
    clip: earthClip.url,
    poster: earthPoster.url,
    cutout: earthCutout.url,
    description:
      "Astronomy gifts, maps and essentials for curious minds.",
  },
  {
    id: "venus",
    name: "VENUS",
    clip: venusClip.url,
    poster: venusPoster.url,
    cutout: venusCutout.url,
    description:
      "Atmospheric lighting and cosmic décor for softer evenings.",
  },
  {
    id: "mars",
    name: "MARS",
    clip: marsClip.url,
    poster: marsPoster.url,
    cutout: marsCutout.url,
    description:
      "Stargazing gear and space gifts for the next frontier.",
  },
] as const;

export type PlanetId = (typeof PLANETS)[number]["id"];
export function sidePlanets(featured: PlanetId) {
  return PLANETS.filter((planet) => planet.id !== featured);
}
