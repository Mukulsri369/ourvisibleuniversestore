import type { ComponentType as ReactComponentType, ReactNode } from "react";
import {
  COMPONENT_TYPES,
  EditorNodeSchema,
  LEAF_COMPONENT_TYPES,
  ROOT_ONLY_COMPONENT_TYPES,
  SafeComponentPropsSchema,
  type ComponentType,
  type EditorNode,
  type SafeComponentProps,
} from "../schema/nodes";
import {
  NodeStyleBundleSchema,
  type EditorBreakpoint,
  type NodeStyleBundle,
} from "../schema/responsive";
import { FORBIDDEN_BUSINESS_DATA_KEYS } from "../schema/bindings";
import {
  TRUSTED_COMPONENT_CAPABILITIES,
  type ComponentCategoryGroup,
  type ComponentImplementationStatus,
  type ComponentSlotDefinition,
  type TrustedComponentCapabilities,
} from "./component-capabilities";
import {
  cloneDefaultComponentBinding,
  cloneDefaultComponentProps,
  cloneDefaultComponentStyle,
} from "./component-defaults";

export interface ComponentAdapterRenderProps {
  node: EditorNode;
  resolvedStyle: NodeStyleBundle;
  breakpoint: EditorBreakpoint;
  children?: ReactNode;
  slots?: Record<string, ReactNode>;
}

export type RegisteredAdapterComponent = ReactComponentType<ComponentAdapterRenderProps>;

export interface RegisteredComponentDefinition {
  readonly type: ComponentType;
  readonly capabilities: TrustedComponentCapabilities;
  readonly defaultProps: Readonly<SafeComponentProps>;
  readonly defaultStyle: Readonly<NodeStyleBundle>;
  readonly adapter: RegisteredAdapterComponent;
}

export interface NodeConfigurationValidationResult {
  valid: boolean;
  errors: string[];
  unsupportedStyleWarnings: string[];
}

export interface RegistryFilterOptions {
  category?: ComponentCategoryGroup;
  status?: ComponentImplementationStatus;
  includeRootOnly?: boolean;
  includeGlobalChrome?: boolean;
}

export class DuplicateComponentRegistrationError extends Error {
  public readonly componentType: string;

  constructor(componentType: string) {
    super(`Component type "${componentType}" is already registered in VisualComponentRegistry.`);
    this.name = "DuplicateComponentRegistrationError";
    this.componentType = componentType;
  }
}

export function detectUnsupportedStyleOverrides(
  type: ComponentType,
  style: NodeStyleBundle | undefined,
): string[] {
  if (!style) return [];
  const capabilities = TRUSTED_COMPONENT_CAPABILITIES[type];
  if (!capabilities) return [];

  const warnings: string[] = [];
  for (const path of capabilities.unsupportedStylePaths) {
    const parts = path.split(".");
    let cursor: unknown = style;
    for (const part of parts) {
      if (
        cursor !== null &&
        typeof cursor === "object" &&
        part in (cursor as Record<string, unknown>)
      ) {
        cursor = (cursor as Record<string, unknown>)[part];
      } else {
        cursor = undefined;
        break;
      }
    }
    if (cursor !== undefined) {
      warnings.push(
        `Component "${type}" does not support style override path "${path}"; property is ignored to preserve storefront fidelity.`,
      );
    }
  }
  return warnings;
}

function hasForbiddenBusinessKeys(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_BUSINESS_DATA_KEYS.has(key)) {
      return key;
    }
    const childMatch = hasForbiddenBusinessKeys(nested);
    if (childMatch) return childMatch;
  }
  return null;
}

export class VisualComponentRegistry {
  private readonly definitions = new Map<ComponentType, RegisteredComponentDefinition>();

  /**
   * 1. Register a component definition with its trusted capabilities and React adapter.
   * Prevents accidental duplicate registration unless `allowOverride` is explicitly true.
   */
  public registerComponent(
    definition: {
      type: ComponentType;
      adapter: RegisteredAdapterComponent;
      defaultProps?: SafeComponentProps;
      defaultStyle?: NodeStyleBundle;
    },
    options?: { allowOverride?: boolean },
  ): RegisteredComponentDefinition {
    if (!COMPONENT_TYPES.includes(definition.type)) {
      throw new Error(`Unknown component type "${String(definition.type)}" cannot be registered.`);
    }

    if (this.definitions.has(definition.type) && !options?.allowOverride) {
      throw new DuplicateComponentRegistrationError(definition.type);
    }

    const trustedCapabilities = TRUSTED_COMPONENT_CAPABILITIES[definition.type];
    const registered: RegisteredComponentDefinition = Object.freeze({
      type: definition.type,
      capabilities: trustedCapabilities,
      defaultProps: Object.freeze(
        definition.defaultProps ?? cloneDefaultComponentProps(definition.type),
      ),
      defaultStyle: Object.freeze(
        definition.defaultStyle ?? cloneDefaultComponentStyle(definition.type),
      ),
      adapter: definition.adapter,
    });

    this.definitions.set(definition.type, registered);
    return registered;
  }

  /**
   * 2. Find a registered component definition by type.
   * Unknown types fail safely by returning `undefined`.
   */
  public getComponent(type: string): RegisteredComponentDefinition | undefined {
    if (!this.isKnownType(type)) return undefined;
    return this.definitions.get(type);
  }

  /**
   * 3. Check registration status.
   */
  public hasComponent(type: string): boolean {
    if (!this.isKnownType(type)) return false;
    return this.definitions.has(type);
  }

  /**
   * 4. Validate a node's configuration against the registry, Zod schema, and security boundaries.
   */
  public validateNodeConfiguration(
    node: unknown,
    context?: { isRootLevel: boolean },
  ): NodeConfigurationValidationResult {
    const errors: string[] = [];
    const unsupportedStyleWarnings: string[] = [];

    if (!node || typeof node !== "object") {
      return {
        valid: false,
        errors: ["Node configuration must be a non-null object."],
        unsupportedStyleWarnings: [],
      };
    }

    const candidate = node as Record<string, unknown>;
    const rawType = candidate.type;
    if (typeof rawType !== "string" || !this.hasComponent(rawType)) {
      return {
        valid: false,
        errors: [`Unregistered or unknown component type: "${String(rawType)}".`],
        unsupportedStyleWarnings: [],
      };
    }

    const forbiddenKey =
      hasForbiddenBusinessKeys(candidate.props) ||
      hasForbiddenBusinessKeys(candidate.style) ||
      hasForbiddenBusinessKeys(candidate.binding);
    if (forbiddenKey) {
      errors.push(
        `Protected business property "${forbiddenKey}" is forbidden inside visual node configuration.`,
      );
    }

    // Prevent untrusted JSON from attempting to inject capability overrides
    if ("capabilities" in candidate || "trustedCapabilities" in candidate) {
      errors.push("Untrusted node payload cannot define or override component capabilities.");
    }

    const parsedNode = EditorNodeSchema.safeParse(node);
    if (!parsedNode.success) {
      for (const issue of parsedNode.error.issues) {
        errors.push(`${issue.path.join(".") || "node"}: ${issue.message}`);
      }
      return { valid: false, errors, unsupportedStyleWarnings };
    }

    const validNode = parsedNode.data;
    const propsCheck = SafeComponentPropsSchema.safeParse(validNode.props);
    if (!propsCheck.success) {
      for (const issue of propsCheck.error.issues) {
        errors.push(`props.${issue.path.join(".")}: ${issue.message}`);
      }
    }

    const styleCheck = NodeStyleBundleSchema.safeParse(validNode.style);
    if (!styleCheck.success) {
      for (const issue of styleCheck.error.issues) {
        errors.push(`style.${issue.path.join(".")}: ${issue.message}`);
      }
    }

    const capabilities = this.getTrustedCapabilities(validNode.type);
    if (capabilities) {
      if (context && capabilities.isRootOnly && !context.isRootLevel)
        errors.push("Root-only component cannot be nested");
      if (
        validNode.binding &&
        !capabilities.supportedBindingKinds.includes(validNode.binding.kind)
      ) {
        errors.push(
          `Component "${validNode.type}" does not support binding kind "${validNode.binding.kind}".`,
        );
      }

      if (capabilities.isLeaf && validNode.children.length > 0) {
        errors.push(`Leaf component "${validNode.type}" cannot contain child nodes.`);
      }

      if (validNode.slots) {
        const supportedSlotNames = new Set(capabilities.supportedSlots.map((s) => s.slotName));
        for (const [slotName, slotChildren] of Object.entries(validNode.slots)) {
          if (!supportedSlotNames.has(slotName)) {
            errors.push(`Component "${validNode.type}" does not support slot "${slotName}".`);
            continue;
          }
          const slotDef = capabilities.supportedSlots.find((s) => s.slotName === slotName);
          if (slotDef?.maxChildren !== undefined && slotChildren.length > slotDef.maxChildren) {
            errors.push(
              `Slot "${slotName}" on "${validNode.type}" exceeds maxChildren (${slotDef.maxChildren}).`,
            );
          }
          for (const child of slotChildren) {
            if (!this.canAcceptChild(validNode.type, child.type, slotName)) {
              errors.push(
                `Slot "${slotName}" on "${validNode.type}" cannot accept child of type "${child.type}".`,
              );
            }
          }
        }
      }
    }

    unsupportedStyleWarnings.push(
      ...detectUnsupportedStyleOverrides(validNode.type, validNode.style),
    );

    return {
      valid: errors.length === 0,
      errors,
      unsupportedStyleWarnings,
    };
  }

  /**
   * 5. Access cloned default properties, styles, and bindings for a component type.
   */
  public getDefaultConfiguration(type: ComponentType): {
    props: SafeComponentProps;
    style: NodeStyleBundle;
    binding?: EditorNode["binding"];
  } {
    return {
      props: cloneDefaultComponentProps(type),
      style: cloneDefaultComponentStyle(type),
      binding: cloneDefaultComponentBinding(type),
    };
  }

  /**
   * 6. Read trusted capabilities (always authoritative from code, never from user JSON).
   */
  public getTrustedCapabilities(type: string): TrustedComponentCapabilities | undefined {
    if (!this.isKnownType(type)) return undefined;
    return TRUSTED_COMPONENT_CAPABILITIES[type];
  }

  /**
   * 7. Resolve the React adapter implementation for a component type.
   */
  public resolveComponentRenderer(type: string): RegisteredAdapterComponent | undefined {
    return this.getComponent(type)?.adapter;
  }

  /**
   * 8. Read supported named slots for a component type.
   */
  public getSupportedSlots(type: string): readonly ComponentSlotDefinition[] {
    const capabilities = this.getTrustedCapabilities(type);
    return capabilities?.supportedSlots ?? [];
  }

  /**
   * 9. Check parent/child compatibility, enforcing leaf, root-only, and slot rules.
   */
  public canAcceptChild(parentType: string, childType: string, slotName?: string): boolean {
    if (!this.isKnownType(parentType) || !this.isKnownType(childType)) {
      return false;
    }

    if (LEAF_COMPONENT_TYPES.has(parentType)) {
      return false;
    }

    if (ROOT_ONLY_COMPONENT_TYPES.has(childType)) {
      return false;
    }

    if (slotName) {
      const slots = this.getSupportedSlots(parentType);
      const slot = slots.find((s) => s.slotName === slotName);
      if (!slot) return false;
      if (slot.allowedChildTypes && !slot.allowedChildTypes.includes(childType)) {
        return false;
      }
    }

    return true;
  }

  /**
   * 10. Enumerate registered components deterministically for the component library & inspector.
   */
  public listComponents(filter?: RegistryFilterOptions): RegisteredComponentDefinition[] {
    const results: RegisteredComponentDefinition[] = [];
    for (const type of COMPONENT_TYPES) {
      const def = this.definitions.get(type);
      if (!def) continue;
      if (filter?.category && def.capabilities.category !== filter.category) continue;
      if (filter?.status && def.capabilities.status !== filter.status) continue;
      if (filter?.includeRootOnly === false && def.capabilities.isRootOnly) continue;
      if (filter?.includeGlobalChrome === false && def.capabilities.isGlobalChrome) continue;
      results.push(def);
    }
    return results;
  }

  private isKnownType(type: string): type is ComponentType {
    return (COMPONENT_TYPES as readonly string[]).includes(type);
  }
}
