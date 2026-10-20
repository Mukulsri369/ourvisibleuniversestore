import { VisualComponentRegistry } from "./component-registry";
import { PlanetHeroAdapter } from "../adapters/PlanetHeroAdapter";
import { CelestialScrollWorldAdapter } from "../adapters/CelestialScrollWorldAdapter";
import { ProductScrollRailAdapter } from "../adapters/ProductScrollRailAdapter";
import { ProductCardAdapter } from "../adapters/ProductCardAdapter";
import { CategorySpotlightAdapter } from "../adapters/CategorySpotlightAdapter";
import { CategoryCardAdapter } from "../adapters/CategoryCardAdapter";
import { StoreFooterAdapter, StoreHeaderAdapter } from "../adapters/StoreChromeAdapter";
import {
  BenefitsSectionAdapter,
  ButtonAdapter,
  CategoryGridSectionAdapter,
  ContainerAdapter,
  DividerAdapter,
  FeaturedCollectionSectionAdapter,
  FestivalSectionAdapter,
  HeadingAdapter,
  IconAdapter,
  ImageAdapter,
  InstagramSectionAdapter,
  InterestSectionAdapter,
  ProductGridSectionAdapter,
  PromotionalBannerAdapter,
  SectionAdapter,
  ShapeAdapter,
  SpacerAdapter,
  TextAdapter,
  VideoAdapter,
} from "../adapters/GenericElementsAdapter";

export function registerAllDefaultComponents(
  registry: VisualComponentRegistry,
): VisualComponentRegistry {
  // 1. Basic elements (9)
  registry.registerComponent({ type: "Text", adapter: TextAdapter });
  registry.registerComponent({ type: "Heading", adapter: HeadingAdapter });
  registry.registerComponent({ type: "Image", adapter: ImageAdapter });
  registry.registerComponent({ type: "Video", adapter: VideoAdapter });
  registry.registerComponent({ type: "Button", adapter: ButtonAdapter });
  registry.registerComponent({ type: "Icon", adapter: IconAdapter });
  registry.registerComponent({ type: "Divider", adapter: DividerAdapter });
  registry.registerComponent({ type: "Spacer", adapter: SpacerAdapter });
  registry.registerComponent({ type: "Shape", adapter: ShapeAdapter });

  // 2. Layout elements (6)
  registry.registerComponent({ type: "Section", adapter: SectionAdapter });
  registry.registerComponent({ type: "Container", adapter: ContainerAdapter });
  registry.registerComponent({ type: "Stack", adapter: ContainerAdapter });
  registry.registerComponent({ type: "Grid", adapter: ContainerAdapter });
  registry.registerComponent({ type: "GridItem", adapter: ContainerAdapter });
  registry.registerComponent({ type: "Overlay", adapter: ContainerAdapter });

  // 3. Storefront elements (8)
  registry.registerComponent({ type: "PlanetHero", adapter: PlanetHeroAdapter });
  registry.registerComponent({
    type: "CelestialScrollWorld",
    adapter: CelestialScrollWorldAdapter,
  });
  registry.registerComponent({
    type: "ProductScrollRail",
    adapter: ProductScrollRailAdapter,
  });
  registry.registerComponent({ type: "ProductCard", adapter: ProductCardAdapter });
  registry.registerComponent({
    type: "CategorySpotlightHero",
    adapter: CategorySpotlightAdapter,
  });
  registry.registerComponent({ type: "CategoryCard", adapter: CategoryCardAdapter });
  registry.registerComponent({ type: "StoreHeader", adapter: StoreHeaderAdapter });
  registry.registerComponent({ type: "StoreFooter", adapter: StoreFooterAdapter });

  // 4. Storefront & Future sections (8)
  registry.registerComponent({
    type: "ProductGrid",
    adapter: ProductGridSectionAdapter,
  });
  registry.registerComponent({
    type: "CategoryGrid",
    adapter: CategoryGridSectionAdapter,
  });
  registry.registerComponent({
    type: "FestivalSection",
    adapter: FestivalSectionAdapter,
  });
  registry.registerComponent({
    type: "FeaturedCollection",
    adapter: FeaturedCollectionSectionAdapter,
  });
  registry.registerComponent({
    type: "PromotionalBanner",
    adapter: PromotionalBannerAdapter,
  });
  registry.registerComponent({
    type: "InterestSection",
    adapter: InterestSectionAdapter,
  });
  registry.registerComponent({
    type: "BenefitsSection",
    adapter: BenefitsSectionAdapter,
  });
  registry.registerComponent({
    type: "InstagramSection",
    adapter: InstagramSectionAdapter,
  });

  return registry;
}

export function createDefaultComponentRegistry(): VisualComponentRegistry {
  return registerAllDefaultComponents(new VisualComponentRegistry());
}

export const defaultComponentRegistry: VisualComponentRegistry = createDefaultComponentRegistry();
