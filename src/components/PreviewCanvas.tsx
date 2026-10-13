"use client";

import { useEffect, useRef } from "react";
import { dragTransform } from "@/lib/geometry/drag";
import { clientToOutput, panelAtPoint } from "@/lib/geometry/hitTest";
import { OUTPUT_HEIGHT, OUTPUT_WIDTH } from "@/lib/geometry/output";
import { drawPlaceholders } from "@/lib/render/drawPlaceholder";
import { drawSelection } from "@/lib/render/drawSelection";
import { renderComposite, type PanelSources } from "@/lib/render/renderComposite";
import { useEditorStore } from "@/store/editor";

/** Output pixels a pointer must travel before a press counts as a drag, not a tap. */
const DRAG_THRESHOLD = 12;

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
  const selectedPanelId = useEditorStore((s) => s.selectedPanelId);
  const drag = useRef<{ id: string; x: number; y: number; moved: boolean } | null>(null);

  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    renderComposite(ctx, { layoutId, panels }, sources);
    drawPlaceholders(ctx, panels);
    drawSelection(ctx, panels, selectedPanelId);
  }, [layoutId, panels, sources, selectedPanelId]);

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
      onPointerDown={(e) => {
        const panel = panelAt(e);
        if (!panel) return;
        const point = clientToOutput(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect());
        if (!point) return;
        drag.current = { id: panel.id, x: point.x, y: point.y, moved: false };
        if (panel.media) {
          e.currentTarget.setPointerCapture(e.pointerId);
          useEditorStore.getState().selectPanel(panel.id);
        }
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        const point = clientToOutput(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect());
        if (!point) return;
        const dx = point.x - d.x;
        const dy = point.y - d.y;
        if (!d.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
        d.moved = true;
        d.x = point.x;
        d.y = point.y;
        const { panels: current, setTransform } = useEditorStore.getState();
        const panel = current.find((p) => p.id === d.id);
        if (!panel?.media) return;
        const { naturalWidth, naturalHeight } = panel.media;
        setTransform(
          panel.id,
          dragTransform(naturalWidth, naturalHeight, panel.rect, panel.transform, dx, dy),
        );
      }}
      onPointerUp={() => {
        const d = drag.current;
        drag.current = null;
        if (d && !d.moved) onPanelTap?.(d.id);
      }}
      onPointerCancel={() => {
        drag.current = null;
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
      className="mx-auto block max-h-full max-w-full touch-none bg-black"
      style={{ aspectRatio: `${OUTPUT_WIDTH} / ${OUTPUT_HEIGHT}` }}
    />
  );
}
