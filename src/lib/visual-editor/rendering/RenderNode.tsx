import React, { Component, memo, type ErrorInfo, type ReactNode } from "react";
import type { EditorNode } from "../schema/nodes";
import { usePageRenderContext, type RenderMode } from "./RenderContext";
import { resolveResponsiveNodePresentation } from "./responsive-styles";

interface NodeErrorBoundaryProps {
  nodeId: string;
  nodeType: string;
  mode: RenderMode;
  children: ReactNode;
}

interface NodeErrorBoundaryState {
  hasError: boolean;
  errorMessage: string | null;
}

export class NodeErrorBoundary extends Component<NodeErrorBoundaryProps, NodeErrorBoundaryState> {
  public override state: NodeErrorBoundaryState = {
    hasError: false,
    errorMessage: null,
  };

  public static getDerivedStateFromError(error: unknown): NodeErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }

  public override componentDidCatch(_error: Error, _info: ErrorInfo) {
    // Error is isolated to the single node boundary so the rest of the storefront/editor stays live
  }

  public override render() {
    if (this.state.hasError) {
      if (this.props.mode === "public") {
        return null;
      }
      return (
        <div
          role="alert"
          data-editor-node-error={this.props.nodeId}
          className="rounded-xl border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive"
        >
          Failed to render component <strong>{this.props.nodeType}</strong> (
          <code>{this.props.nodeId}</code>)
        </div>
      );
    }
    return this.props.children;
  }
}

export interface RenderNodeProps {
  node: EditorNode;
}

function RenderNodeInner({ node }: RenderNodeProps) {
  const { mode, breakpoint, registry } = usePageRenderContext();

  const presentation = resolveResponsiveNodePresentation(node, breakpoint);
  if (!presentation.visible) {
    return null;
  }

  const definition = registry.getComponent(node.type);
  if (!definition) {
    if (mode === "public") {
      return null;
    }
    return (
      <div
        data-editor-unknown-component={String(node.type)}
        data-editor-node-id={node.id}
        className="rounded-xl border border-border/70 bg-secondary/40 p-3 text-xs text-muted-foreground"
      >
        Unknown component type: <code>{String(node.type)}</code>
      </div>
    );
  }

  const AdapterComponent = definition.adapter;

  const renderedChildren =
    node.children && node.children.length > 0
      ? node.children.map((child) => <RenderNode key={child.id} node={child} />)
      : undefined;

  let renderedSlots: Record<string, ReactNode> | undefined;
  if (node.slots && Object.keys(node.slots).length > 0) {
    renderedSlots = {};
    for (const [slotName, slotNodes] of Object.entries(node.slots)) {
      renderedSlots[slotName] = slotNodes.map((slotChild) => (
        <RenderNode key={slotChild.id} node={slotChild} />
      ));
    }
  }

  return (
    <NodeErrorBoundary nodeId={node.id} nodeType={node.type} mode={mode}>
      <AdapterComponent
        node={node}
        resolvedStyle={presentation.resolvedStyleBundle}
        breakpoint={breakpoint}
        slots={renderedSlots}
      >
        {renderedChildren}
      </AdapterComponent>
    </NodeErrorBoundary>
  );
}

export const RenderNode = memo(RenderNodeInner);
