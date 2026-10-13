"use client";

import { useEffect, useMemo, useState } from "react";
import type { PanelSources } from "@/lib/render/renderComposite";
import type { PanelSource } from "@/lib/render/drawPanel";
import { useEditorStore } from "@/store/editor";

/**
 * Decoded `<img>` per image panel, keyed by panel id, so the preview can draw
 * them. Rebuilt only when a panel's object URL changes. Videos arrive in Phase 3.
 */
export function useImageSources(): PanelSources {
  const panels = useEditorStore((s) => s.panels);
  const [loaded, setLoaded] = useState<ReadonlyMap<string, { url: string; img: PanelSource }>>(
    new Map(),
  );

  const key = panels
    .map((p) => (p.media?.kind === "image" ? `${p.id}=${p.media.objectUrl}` : ""))
    .join("|");

  useEffect(() => {
    let cancelled = false;
    const current = useEditorStore.getState().panels;
    for (const p of current) {
      const media = p.media;
      if (media?.kind !== "image") continue;
      const img = new Image();
      img.onload = () => {
        if (cancelled) return;
        setLoaded((prev) => new Map(prev).set(p.id, { url: media.objectUrl, img }));
      };
      img.src = media.objectUrl;
    }
    return () => {
      cancelled = true;
    };
  }, [key]);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` captures the panels' image URLs
  return useMemo(() => {
    const sources = new Map<string, PanelSource>();
    for (const p of panels) {
      const entry = loaded.get(p.id);
      if (p.media?.kind === "image" && entry?.url === p.media.objectUrl) {
        sources.set(p.id, entry.img);
      }
    }
    return sources;
  }, [key, loaded]);
}
