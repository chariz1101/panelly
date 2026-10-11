"use client";

import { useEffect, useRef } from "react";
import { OUTPUT_HEIGHT, OUTPUT_WIDTH } from "@/lib/geometry/output";
import { drawPlaceholders } from "@/lib/render/drawPlaceholder";
import { renderComposite, type PanelSources } from "@/lib/render/renderComposite";
import { useEditorStore } from "@/store/editor";

const NO_SOURCES: PanelSources = new Map();

interface PreviewCanvasProps {
  /** Current drawable per panel id. Redraws whenever this or the project changes. */
  sources?: PanelSources;
}

/**
 * The 1080×1920 preview. The backing store is always the output size; CSS only
 * scales it to fit, keeping 9:16. Layout is never computed in CSS pixels (SPEC §3).
 */
export function PreviewCanvas({ sources = NO_SOURCES }: PreviewCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const layoutId = useEditorStore((s) => s.layoutId);
  const panels = useEditorStore((s) => s.panels);

  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    renderComposite(ctx, { layoutId, panels }, sources);
    drawPlaceholders(ctx, panels);
  }, [layoutId, panels, sources]);

  return (
    <canvas
      ref={ref}
      width={OUTPUT_WIDTH}
      height={OUTPUT_HEIGHT}
      aria-label="Story preview"
      className="mx-auto block max-h-full max-w-full bg-black"
      style={{ aspectRatio: `${OUTPUT_WIDTH} / ${OUTPUT_HEIGHT}` }}
    />
  );
}
