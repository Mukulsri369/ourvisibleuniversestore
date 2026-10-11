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
  { id: "earth", name: "EARTH", clip: earthClip.url, poster: earthPoster.url, cutout: earthCutout.url, description: "Our pale blue home. Discover astronomy-inspired products, space gear and cosmic gifts that bring the wonder of the universe closer." },
  { id: "venus", name: "VENUS", clip: venusClip.url, poster: venusPoster.url, cutout: venusCutout.url, description: "A world wrapped in golden clouds, and the hottest planet in our solar system. Find luminous lights, celestial décor and a little otherworldly wonder." },
  { id: "mars", name: "MARS", clip: marsClip.url, poster: marsPoster.url, cutout: marsCutout.url, description: "The rust-red world of towering volcanoes and new horizons. Explore space-inspired gear, gifts and discoveries for your next adventure." },
] as const;

export type PlanetId = typeof PLANETS[number]["id"];
export function sidePlanets(featured: PlanetId) {
  return PLANETS.filter((planet) => planet.id !== featured);
}