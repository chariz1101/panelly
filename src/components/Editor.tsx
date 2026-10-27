"use client";

import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import { LayoutPicker } from "@/components/LayoutPicker";
import { PreviewCanvas } from "@/components/PreviewCanvas";
import { useImageSources } from "@/components/useImageSources";
import { useVideoSources } from "@/components/useVideoSources";
import { describeExportError, SHARE_UNAVAILABLE_NOTE } from "@/lib/errors/describeError";
import { canShareFiles, deliverFile } from "@/lib/export/deliver";
import {
  failureReason,
  projectShape,
  trackExportFailed,
  trackExportSucceeded,
  type ExportMode as AnalyticsMode,
} from "@/lib/analytics/events";
import { FallbackCancelled, recordFallback } from "@/lib/export/exportFallback";
import { startExport } from "@/lib/export/exportClient";
import { exportStill, isStillProject } from "@/lib/export/exportStill";
import { progressFraction } from "@/lib/export/protocol";
import { LIMITED_MODE_WARNING, exportModeFor, extensionForMime } from "@/lib/export/support";
import { projectDurationMs } from "@/lib/geometry/duration";
import { MAX_SCALE, MIN_SCALE, withScale } from "@/lib/geometry/zoom";
import { ACCEPT, mediaKindOf } from "@/lib/import/fileKind";
import { probeVideoCodec } from "@/lib/import/probeCodec";
import { probeImage } from "@/lib/import/probeImage";
import { probeVideo } from "@/lib/import/probeVideo";
import { snapshotFile } from "@/lib/import/snapshotFile";
import { validateFileSize } from "@/lib/import/validate";
import { applyMuteState, primeVideos } from "@/lib/render/videoElements";
import { useEditorStore } from "@/store/editor";
import type { Panel } from "@/types";

/** Browser capabilities never change at runtime, so there is nothing to subscribe to. */
const subscribeNever = () => () => {};

/** Confirmation after a download, noting when the share sheet wasn't an option (SPEC §8). */
function savedMessage(filename: string, mime: string): string {
  const saved = `Saved ${filename} to your downloads.`;
  return canShareFiles(mime) ? saved : `${saved} ${SHARE_UNAVAILABLE_NOTE}`;
}

/** Thrown when the user cancels a running video export (SPEC §6.5). */
class ExportCancelled extends Error {}

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
  const exportProgress = useEditorStore((s) => s.exportState.progress);
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
  const exportRef = useRef<{ cancel: () => void } | null>(null);
  const limitedMode = useSyncExternalStore(
    subscribeNever,
    () => exportModeFor() === "limited",
    () => false,
  );
  const [targetId, setTargetId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const acceptFile = async (panelId: string, picked: File) => {
    const kind = mediaKindOf(picked);
    if (!kind) {
      setMessage("That file isn't a photo or video.");
      return;
    }
    const tooBig = validateFileSize(picked);
    if (tooBig) {
      setMessage(tooBig);
      return;
    }
    try {
      // Copy the bytes before anything else: Android can revoke read access to the picked file.
      const file = await snapshotFile(picked);
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
    setMessage(null);
    setExportState({ status: "exporting", progress: 0, error: null });
    const shape = projectShape(panels, projectDurationMs(panels));
    let mode: AnalyticsMode = "still";
    try {
      if (isStillProject({ panels })) {
        const blob = await exportStill({ layoutId, panels }, sources);
        trackExportSucceeded({ format: "png", mode, ...shape });
        const result = await deliverFile(blob, "panelly.png");
        setExportState({ status: "done", progress: 1 });
        if (result === "downloaded") setMessage(savedMessage("panelly.png", blob.type));
        return;
      }
      mode = exportModeFor();
      const { blob, encodedAs } =
        mode === "limited"
          ? { blob: await exportLimited(layoutId, panels), encodedAs: undefined }
          : await exportVideo(layoutId, panels);
      const extension = extensionForMime(blob.type);
      trackExportSucceeded({ format: extension, mode, encodedAs, ...shape });
      const filename = `panelly.${extension}`;
      const result = await deliverFile(blob, filename);
      setExportState({ status: "done", progress: 1 });
      if (result === "downloaded") setMessage(savedMessage(filename, blob.type));
    } catch (err) {
      if (err instanceof ExportCancelled || err instanceof FallbackCancelled) {
        setExportState({ status: "idle", progress: 0, error: null });
        return;
      }
      const error = describeExportError(err);
      trackExportFailed({ mode, reason: failureReason(error) });
      setExportState({ status: "error", error });
      setMessage(error);
    } finally {
      exportRef.current = null;
    }
  };

  /** Limited mode (SPEC §6.3): record the composite in real time with MediaRecorder. */
  const exportLimited = async (layoutId: string, panels: Panel[]): Promise<Blob> => {
    primeVideos(sources);
    const handle = recordFallback({ layoutId, panels }, sources, {
      durationMs: projectDurationMs(panels),
      onProgress: (progress) => setExportState({ progress }),
    });
    exportRef.current = handle;
    return handle.result;
  };

  /** Run the worker export, mirroring its frame progress into the store. */
  const exportVideo = async (
    layoutId: string,
    panels: Panel[],
  ): Promise<{ blob: Blob; encodedAs: string }> => {
    const bitmaps: Record<string, ImageBitmap> = {};
    for (const panel of panels) {
      const source = panel.media?.kind === "image" ? sources.get(panel.id) : undefined;
      if (source) bitmaps[panel.id] = await createImageBitmap(source as HTMLImageElement);
    }
    const handle = startExport(
      { layoutId, panels, durationMs: projectDurationMs(panels) },
      bitmaps,
    );
    exportRef.current = handle;
    for await (const event of handle.events) {
      if (event.type === "progress") {
        setExportState({ progress: progressFraction(event.framesDone, event.framesTotal) });
      } else if (event.type === "done") {
        return { blob: event.blob, encodedAs: event.encodedAs };
      } else if (event.type === "cancelled") {
        throw new ExportCancelled();
      } else {
        throw new Error(event.message);
      }
    }
    throw new Error("Export failed.");
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
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2">
              <span aria-hidden="true">Zoom</span>
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
            <div className="flex items-center gap-2 [&>button]:flex-1">
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
          </div>
        ) : (
          <p className="text-center opacity-60">Tap an empty panel to add a photo or video.</p>
        )}
        {exportStatus === "exporting" && (
          <p role="status" className="sr-only">
            {`Exporting, ${Math.round(exportProgress * 100)} percent`}
          </p>
        )}
        {limitedMode && hasVideo && (
          <p className="mt-2 text-center text-sm text-amber-300">{LIMITED_MODE_WARNING}</p>
        )}
        {selected?.media?.kind === "video" && (
          <p className="mt-2 text-center text-sm opacity-60">Exports are silent in this version</p>
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
        {exportStatus === "exporting" && (
          <button
            type="button"
            onClick={() => exportRef.current?.cancel()}
            className="min-h-11 rounded-lg border border-white/20 px-4 text-sm font-semibold"
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          disabled={exportStatus === "exporting" || !hasMedia}
          onClick={() => void handleExport()}
          className="min-h-11 rounded-lg bg-white px-4 text-sm font-semibold text-black disabled:opacity-40"
        >
          {exportStatus === "exporting"
            ? `Exporting… ${Math.round(exportProgress * 100)}%`
            : "Export"}
        </button>
      </nav>
    </div>
  );
}
