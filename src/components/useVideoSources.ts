"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PanelSource } from "@/lib/render/drawPanel";
import type { PanelSources } from "@/lib/render/renderComposite";
import { applyMuteState } from "@/lib/render/videoElements";
import { useEditorStore } from "@/store/editor";

interface Entry {
  url: string;
  el: HTMLVideoElement;
}

function dispose({ el }: Entry): void {
  el.pause();
  el.removeAttribute("src");
  el.load();
}

/**
 * One hidden `<video>` per video panel, keyed by panel id, ready to be drawn
 * once a frame has loaded. Elements are created once per object URL, so adding
 * or editing another panel never reloads a video that is already playing.
 */
export function useVideoSources(): PanelSources {
  const panels = useEditorStore((s) => s.panels);
  const created = useRef(new Map<string, Entry>());
  const [loaded, setLoaded] = useState<ReadonlyMap<string, Entry>>(new Map());

  const key = panels
    .map((p) => (p.media?.kind === "video" ? `${p.id}=${p.media.objectUrl}` : ""))
    .join("|");

  useEffect(() => {
    const wanted = new Map<string, string>();
    for (const p of useEditorStore.getState().panels) {
      if (p.media?.kind === "video") wanted.set(p.id, p.media.objectUrl);
    }
    for (const [id, entry] of created.current) {
      if (wanted.get(id) !== entry.url) {
        dispose(entry);
        created.current.delete(id);
      }
    }
    for (const [id, url] of wanted) {
      if (created.current.has(id)) continue;
      const el = document.createElement("video");
      el.muted = true;
      el.playsInline = true;
      el.setAttribute("playsinline", "");
      el.setAttribute("webkit-playsinline", "");
      el.preload = "auto";
      const entry: Entry = { url, el };
      created.current.set(id, entry);
      el.onloadeddata = () => setLoaded((prev) => new Map(prev).set(id, entry));
      el.src = url;
    }
  }, [key]);

  // Keep element audio in step with the store (e.g. after a layout change).
  useEffect(() => {
    const els = new Map([...created.current].map(([id, e]) => [id, e.el]));
    applyMuteState(panels, els);
  }, [panels, loaded]);

  useEffect(() => {
    const map = created.current;
    return () => {
      for (const entry of map.values()) dispose(entry);
      map.clear();
    };
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` captures the panels' video URLs
  return useMemo(() => {
    const sources = new Map<string, PanelSource>();
    for (const p of panels) {
      const entry = loaded.get(p.id);
      if (p.media?.kind === "video" && entry?.url === p.media.objectUrl) {
        sources.set(p.id, entry.el);
      }
    }
    return sources;
  }, [key, loaded]);
}
