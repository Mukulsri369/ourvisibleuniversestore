import React, { useEffect, useRef, useState } from "react";

export interface LayerRenameInputProps {
  nodeId: string;
  initialName: string;
  onCommit: (nodeId: string, nextName: string) => void;
  onCancel: () => void;
}

export function LayerRenameInput({
  nodeId,
  initialName,
  onCommit,
  onCancel,
}: LayerRenameInputProps) {
  const [value, setValue] = useState(initialName);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const committedOrCancelledRef = useRef(false);

  useEffect(() => {
    const el = inputRef.current;
    if (el) {
      el.focus();
      el.select();
    }
  }, []);

  const handleCommit = () => {
    if (committedOrCancelledRef.current) return;
    committedOrCancelledRef.current = true;
    const trimmed = value.trim();
    if (!trimmed) {
      onCancel();
      return;
    }
    onCommit(nodeId, trimmed);
  };

  const handleCancel = () => {
    if (committedOrCancelledRef.current) return;
    committedOrCancelledRef.current = true;
    onCancel();
  };

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      aria-label={`Rename layer ${initialName}`}
      data-testid={`studio-layer-rename-input-${nodeId}`}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") {
          e.preventDefault();
          handleCommit();
        } else if (e.key === "Escape") {
          e.preventDefault();
          handleCancel();
        }
      }}
      onBlur={() => {
        handleCommit();
      }}
      className="h-5 min-w-0 flex-1 rounded border border-primary/70 bg-background px-1.5 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
    />
  );
}
