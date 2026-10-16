"use client";

import { useMemo, useRef, useState } from "react";
import { LayoutPicker } from "@/components/LayoutPicker";
import { PreviewCanvas } from "@/components/PreviewCanvas";
import { useImageSources } from "@/components/useImageSources";
import { useVideoSources } from "@/components/useVideoSources";
import { deliverFile } from "@/lib/export/deliver";
import { exportStill, isStillProject } from "@/lib/export/exportStill";
import { projectDurationMs } from "@/lib/geometry/duration";
import { MAX_SCALE, MIN_SCALE, withScale } from "@/lib/geometry/zoom";
import { ACCEPT, mediaKindOf } from "@/lib/import/fileKind";
import { probeVideoCodec } from "@/lib/import/probeCodec";
import { probeImage } from "@/lib/import/probeImage";
import { probeVideo } from "@/lib/import/probeVideo";
import { validateFileSize } from "@/lib/import/validate";
import { applyMuteState, primeVideos } from "@/lib/render/videoElements";
import { useEditorStore } from "@/store/editor";

/**
 * Mobile-first editor shell (SPEC §7): canvas, panel controls, bottom bar.
 * No modal or sign-in; the user lands straight in the editor.
 */
export function Editor() {
  const selected = useEditorStore((s) => s.panels.find((p) => p.id === s.selectedPanelId));

  const hasMedia = useEditorStore((s) => s.panels.some((p) => p.media));
  const selectPanel = useEditorStore((s) => s.selectPanel);
  const setMedia = useEditorStore((s) => s.setMedia);
  const removeMedia = useEditorStore((s) => s.removeMedia);
  const setTransform = useEditorStore((s) => s.setTransform);
  const exportStatus = useEditorStore((s) => s.exportState.status);
  const setExportState = useEditorStore((s) => s.setExportState);
  const imageSources = useImageSources();
  const videoSources = useVideoSources();
  const sources = useMemo(
    () => new Map([...imageSources, ...videoSources]),
    [imageSources, videoSources],
  );
  const isPlaying = useEditorStore((s) => s.playback.isPlaying);
  const setPlaying = useEditorStore((s) => s.setPlaying);
  const toggleMute = useEditorStore((s) => s.toggleMute);
  const hasVideo = useEditorStore((s) => projectDurationMs(s.panels) > 0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

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
    try {
      const media = kind === "video" ? await probeVideo(file) : await probeImage(file);
      if (media.kind === "video") {
        const unsupported = await probeVideoCodec(file, {
          width: media.naturalWidth,
          height: media.naturalHeight,
        });
        if (unsupported) {
          URL.revokeObjectURL(media.objectUrl);
          setMessage(unsupported);
          return;
        }
      }
      setMessage(null);
      setMedia(panelId, media);
      selectPanel(panelId);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "That file couldn't be read.");
    }
  };

  const handleExport = async () => {
    const { layoutId, panels } = useEditorStore.getState();
    if (!isStillProject({ panels })) {
      setMessage("Video export isn't available yet. Try photos only.");
      return;
    }
    setMessage(null);
    setExportState({ status: "exporting", progress: 0, error: null });
    try {
      const blob = await exportStill({ layoutId, panels }, sources);
      const result = await deliverFile(blob, "panelly.png");
      setExportState({ status: "done", progress: 1 });
      if (result === "downloaded") setMessage("Saved panelly.png to your downloads.");
    } catch (err) {
      const error = err instanceof Error ? err.message : "Export failed.";
      setExportState({ status: "error", error });
      setMessage(error);
    }
  };

  // Runs inside the tap handler so iOS accepts the unmute / play() as a gesture.
  const handleToggleMute = (panelId: string) => {
    toggleMute(panelId);
    applyMuteState(useEditorStore.getState().panels, sources);
  };

  const handleTogglePlay = () => {
    if (!isPlaying) primeVideos(sources);
    setPlaying(!isPlaying);
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
          sources={sources}
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
        ) : selected?.media ? (
          <div className="flex items-center gap-3">
            <label className="flex flex-1 items-center gap-2">
              <span>Zoom</span>
              <input
                type="range"
                aria-label="Zoom"
                className="h-11 flex-1"
                min={MIN_SCALE}
                max={MAX_SCALE}
                step={0.01}
                value={selected.transform.scale}
                onChange={(e) =>
                  setTransform(selected.id, withScale(selected.transform, Number(e.target.value)))
                }
              />
            </label>
            {selected.media.kind === "video" && (
              <button
                type="button"
                aria-pressed={!selected.media.muted}
                aria-label={selected.media.muted ? "Unmute panel" : "Mute panel"}
                className="min-h-11 rounded-md border border-white/20 px-3"
                onClick={() => handleToggleMute(selected.id)}
              >
                {selected.media.muted ? "Unmute" : "Mute"}
              </button>
            )}
            <button
              type="button"
              className="min-h-11 rounded-md border border-white/20 px-3"
              onClick={() => {
                setTargetId(selected.id);
                inputRef.current?.click();
              }}
            >
              Replace
            </button>
            <button
              type="button"
              className="min-h-11 rounded-md border border-white/20 px-3 text-red-300"
              onClick={() => removeMedia(selected.id)}
            >
              Remove
            </button>
          </div>
        ) : (
          <p className="text-center opacity-60">Tap an empty panel to add a photo or video.</p>
        )}
      </section>

      <nav
        aria-label="Editor actions"
        className="flex items-center justify-between gap-2 border-t border-white/10 px-4 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
      >
        <LayoutPicker />
        {hasVideo && (
          <button
            type="button"
            aria-pressed={isPlaying}
            onClick={handleTogglePlay}
            className="min-h-11 rounded-lg border border-white/20 px-4 text-sm font-semibold"
          >
            {isPlaying ? "Pause" : "Play"}
          </button>
        )}
        <button
          type="button"
          disabled={exportStatus === "exporting" || !hasMedia}
          onClick={() => void handleExport()}
          className="min-h-11 rounded-lg bg-white px-4 text-sm font-semibold text-black disabled:opacity-40"
        >
          {exportStatus === "exporting" ? "Exporting…" : "Export"}
        </button>
      </nav>
    </div>
  );
}
