"use client";

import { useCallback, useEffect, useRef } from "react";
import { dragTransform } from "@/lib/geometry/drag";
import { clientToOutput, panelAtPoint } from "@/lib/geometry/hitTest";
import { OUTPUT_HEIGHT, OUTPUT_WIDTH } from "@/lib/geometry/output";
import { pinchScale, wheelScale, withScale } from "@/lib/geometry/zoom";
import { drawPlaceholders } from "@/lib/render/drawPlaceholder";
import { drawSelection } from "@/lib/render/drawSelection";
import { renderComposite, type PanelSources } from "@/lib/render/renderComposite";
import { usePreviewClock } from "@/components/usePreviewClock";
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
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ id: string; startDistance: number; startScale: number } | null>(null);

  // Reads the latest editor state so the playback clock can call it every frame.
  const redraw = useCallback(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    const s = useEditorStore.getState();
    renderComposite(ctx, { layoutId: s.layoutId, panels: s.panels }, sources);
    drawPlaceholders(ctx, s.panels);
    drawSelection(ctx, s.panels, s.selectedPanelId);
  }, [sources]);

  useEffect(() => {
    redraw();
  }, [redraw, layoutId, panels, selectedPanelId]);

  usePreviewClock(sources, redraw);

  // Scroll wheel zooms the panel under the cursor. React's onWheel is passive,
  // so this needs a native non-passive listener to stop the page scrolling.
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      const point = clientToOutput(e.clientX, e.clientY, canvas.getBoundingClientRect());
      const { panels: current, setTransform } = useEditorStore.getState();
      const panel = point ? panelAtPoint(current, point) : null;
      if (!panel?.media) return;
      e.preventDefault();
      setTransform(
        panel.id,
        withScale(panel.transform, wheelScale(panel.transform.scale, e.deltaY)),
      );
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, []);

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
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.current.size === 2 && drag.current) {
          // A second finger turns the gesture into a pinch on the panel being dragged.
          const panel = useEditorStore.getState().panels.find((p) => p.id === drag.current?.id);
          const [a, b] = [...pointers.current.values()];
          if (panel?.media && a && b) {
            pinch.current = {
              id: panel.id,
              startDistance: Math.hypot(a.x - b.x, a.y - b.y),
              startScale: panel.transform.scale,
            };
            drag.current.moved = true;
          }
          return;
        }
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
        if (pointers.current.has(e.pointerId)) {
          pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        }
        const z = pinch.current;
        if (z) {
          const [a, b] = [...pointers.current.values()];
          const panel = useEditorStore.getState().panels.find((p) => p.id === z.id);
          if (a && b && panel) {
            const scale = pinchScale(
              z.startScale,
              z.startDistance,
              Math.hypot(a.x - b.x, a.y - b.y),
            );
            useEditorStore.getState().setTransform(z.id, withScale(panel.transform, scale));
          }
          return;
        }
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
      onPointerUp={(e) => {
        pointers.current.delete(e.pointerId);
        if (pinch.current) {
          // End the pinch; the remaining finger must not start a stray drag or tap.
          if (pointers.current.size < 2) pinch.current = null;
          if (pointers.current.size === 0) drag.current = null;
          else if (drag.current) drag.current.moved = true;
          return;
        }
        const d = drag.current;
        drag.current = null;
        if (d && !d.moved) onPanelTap?.(d.id);
      }}
      onPointerCancel={(e) => {
        pointers.current.delete(e.pointerId);
        if (pointers.current.size < 2) pinch.current = null;
        if (pointers.current.size === 0) drag.current = null;
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
