"use client";

import { useEffect, useRef } from "react";
import { clientToOutput, panelAtPoint } from "@/lib/geometry/hitTest";
import { OUTPUT_HEIGHT, OUTPUT_WIDTH } from "@/lib/geometry/output";
import { drawPlaceholders } from "@/lib/render/drawPlaceholder";
import { renderComposite, type PanelSources } from "@/lib/render/renderComposite";
import { useEditorStore } from "@/store/editor";

const NO_SOURCES: PanelSources = new Map();

interface PreviewCanvasProps {
  /** Current drawable per panel id. Redraws whenever this or the project changes. */
  sources?: PanelSources;
  /** A panel was tapped or clicked. */
  onPanelTap?: (panelId: string) => void;
  /** Files were dropped onto a panel (desktop). */
  onPanelDrop?: (panelId: string, files: File[]) => void;
}

/**
 * The 1080×1920 preview. The backing store is always the output size; CSS only
 * scales it to fit, keeping 9:16. Layout is never computed in CSS pixels (SPEC §3).
 */
export function PreviewCanvas({
  sources = NO_SOURCES,
  onPanelTap,
  onPanelDrop,
}: PreviewCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const layoutId = useEditorStore((s) => s.layoutId);
  const panels = useEditorStore((s) => s.panels);

  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    renderComposite(ctx, { layoutId, panels }, sources);
    drawPlaceholders(ctx, panels);
  }, [layoutId, panels, sources]);

  const panelAt = (e: { clientX: number; clientY: number }) => {
    const canvas = ref.current;
    if (!canvas) return null;
    const point = clientToOutput(e.clientX, e.clientY, canvas.getBoundingClientRect());
    return point ? panelAtPoint(panels, point) : null;
  };

  return (
    <canvas
      ref={ref}
      width={OUTPUT_WIDTH}
      height={OUTPUT_HEIGHT}
      aria-label="Story preview"
      onClick={(e) => {
        const panel = panelAt(e);
        if (panel) onPanelTap?.(panel.id);
      }}
      onDragOver={(e) => {
        if (onPanelDrop && panelAt(e)) e.preventDefault();
      }}
      onDrop={(e) => {
        e.preventDefault();
        const panel = panelAt(e);
        const files = Array.from(e.dataTransfer.files);
        if (panel && files.length > 0) onPanelDrop?.(panel.id, files);
      }}
      className="mx-auto block max-h-full max-w-full bg-black"
      style={{ aspectRatio: `${OUTPUT_WIDTH} / ${OUTPUT_HEIGHT}` }}
    />
  );
}
