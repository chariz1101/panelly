"use client";

import { useRef, useState } from "react";
import { LayoutPicker } from "@/components/LayoutPicker";
import { PreviewCanvas } from "@/components/PreviewCanvas";
import { ACCEPT, mediaKindOf } from "@/lib/import/fileKind";
import { probeImage } from "@/lib/import/probeImage";
import { validateFileSize } from "@/lib/import/validate";
import { useEditorStore } from "@/store/editor";

/**
 * Mobile-first editor shell (SPEC §7): canvas, panel controls, bottom bar.
 * No modal or sign-in; the user lands straight in the editor.
 */
export function Editor() {
  const selected = useEditorStore((s) => s.panels.find((p) => p.id === s.selectedPanelId));

  const selectPanel = useEditorStore((s) => s.selectPanel);
  const setMedia = useEditorStore((s) => s.setMedia);
  const inputRef = useRef<HTMLInputElement>(null);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Videos are probed in Phase 3; until then only images are stored.
  const acceptFile = async (panelId: string, file: File) => {
    const kind = mediaKindOf(file);
    if (!kind) {
      setMessage("That file isn't a photo or video.");
      return;
    }
    const tooBig = validateFileSize(file);
    if (tooBig) {
      setMessage(tooBig);
      return;
    }
    if (kind === "video") {
      setMessage("Video import isn't available yet. Try a photo.");
      return;
    }
    try {
      const media = await probeImage(file);
      setMessage(null);
      setMedia(panelId, media);
      selectPanel(panelId);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "That file couldn't be read.");
    }
  };

  const handleTap = (panelId: string) => {
    const panel = useEditorStore.getState().panels.find((p) => p.id === panelId);
    if (panel?.media) {
      selectPanel(panelId);
      return;
    }
    setTargetId(panelId);
    inputRef.current?.click();
  };

  return (
    <div className="mx-auto flex h-dvh w-full max-w-md flex-col">
      <div className="flex min-h-0 flex-1 items-center justify-center p-2">
        <PreviewCanvas
          onPanelTap={handleTap}
          onPanelDrop={(panelId, files) => files[0] && void acceptFile(panelId, files[0])}
        />
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        hidden
        data-testid="file-input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && targetId) void acceptFile(targetId, file);
          e.target.value = "";
        }}
      />

      <section aria-label="Panel controls" className="min-h-14 px-4 py-2 text-sm">
        {message ? (
          <p role="alert" className="text-center text-red-300">
            {message}
          </p>
        ) : selected?.media ? null : (
          <p className="text-center opacity-60">Tap an empty panel to add a photo or video.</p>
        )}
      </section>

      <nav
        aria-label="Editor actions"
        className="flex items-center justify-between gap-2 border-t border-white/10 px-4 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
      >
        <LayoutPicker />
      </nav>
    </div>
  );
}
