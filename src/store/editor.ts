import { create } from "zustand";
import { DEFAULT_LAYOUT, getLayout } from "@/lib/geometry/layouts";
import type { Layout, Panel, PanelMedia, Transform } from "@/types";

/** Unscaled, uncropped framing: cover-fit, centred. */
export const IDENTITY_TRANSFORM: Transform = { scale: 1, offsetX: 0, offsetY: 0 };

export type ExportStatus = "idle" | "exporting" | "done" | "error";

export interface ExportState {
  status: ExportStatus;
  /** 0..1 */
  progress: number;
  error: string | null;
}

export interface PlaybackState {
  isPlaying: boolean;
}

/**
 * Single source of editor state (SPEC §10). Everything is plain data except the
 * `File` and object URL inside `PanelMedia`, so serializing a project later is
 * straightforward.
 */
export interface EditorState {
  layoutId: string;
  panels: Panel[];
  selectedPanelId: string | null;
  /** Which panel's audio survives export; `null` = silent. */
  audioPanelId: string | null;
  playback: PlaybackState;
  exportState: ExportState;
}

export interface EditorActions {
  setLayout: (layoutId: string) => void;
  setMedia: (panelId: string, media: PanelMedia) => void;
  removeMedia: (panelId: string) => void;
  setTransform: (panelId: string, transform: Transform) => void;
  selectPanel: (panelId: string | null) => void;
  toggleMute: (panelId: string) => void;
  setPlaying: (isPlaying: boolean) => void;
  setExportState: (state: Partial<ExportState>) => void;
}

export type EditorStore = EditorState & EditorActions;

export function panelId(index: number): string {
  return `panel-${index}`;
}

function buildPanels(layout: Layout, previous: readonly Panel[] = []): Panel[] {
  return layout.panels.map(({ rect }, i) => {
    const id = panelId(i);
    const old = previous.find((p) => p.id === id);
    return { id, rect, media: old?.media ?? null, transform: old?.transform ?? IDENTITY_TRANSFORM };
  });
}

function releaseMedia(media: PanelMedia | null | undefined): void {
  if (media && typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") {
    URL.revokeObjectURL(media.objectUrl);
  }
}

export function createInitialState(): EditorState {
  return {
    layoutId: DEFAULT_LAYOUT.id,
    panels: buildPanels(DEFAULT_LAYOUT),
    selectedPanelId: null,
    audioPanelId: null,
    playback: { isPlaying: false },
    exportState: { status: "idle", progress: 0, error: null },
  };
}

function mapPanel(panels: Panel[], id: string, update: (p: Panel) => Panel): Panel[] {
  return panels.map((p) => (p.id === id ? update(p) : p));
}

export const useEditorStore = create<EditorStore>()((set, get) => ({
  ...createInitialState(),

  /**
   * Switching layouts keeps media and framing for panels that still exist (by
   * index) and releases media from panels that no longer do.
   */
  setLayout: (layoutId) => {
    const layout = getLayout(layoutId);
    const { layoutId: current, panels, selectedPanelId, audioPanelId } = get();
    if (!layout || layoutId === current) return;

    const next = buildPanels(layout, panels);
    const ids = new Set(next.map((p) => p.id));
    for (const p of panels) if (!ids.has(p.id)) releaseMedia(p.media);

    set({
      layoutId,
      panels: next,
      selectedPanelId: selectedPanelId && ids.has(selectedPanelId) ? selectedPanelId : null,
      audioPanelId: audioPanelId && ids.has(audioPanelId) ? audioPanelId : null,
    });
  },

  /** Replaces any existing media (revoking its URL) and resets the framing. */
  setMedia: (panelId, media) => {
    const target = get().panels.find((p) => p.id === panelId);
    if (!target) return;
    releaseMedia(target.media);
    set((s) => ({
      panels: mapPanel(s.panels, panelId, (p) => ({
        ...p,
        media: { ...media, muted: true },
        transform: IDENTITY_TRANSFORM,
      })),
      audioPanelId: s.audioPanelId === panelId ? null : s.audioPanelId,
    }));
  },

  removeMedia: (panelId) => {
    const target = get().panels.find((p) => p.id === panelId);
    if (!target?.media) return;
    releaseMedia(target.media);
    set((s) => ({
      panels: mapPanel(s.panels, panelId, (p) => ({
        ...p,
        media: null,
        transform: IDENTITY_TRANSFORM,
      })),
      audioPanelId: s.audioPanelId === panelId ? null : s.audioPanelId,
    }));
  },

  setTransform: (panelId, transform) =>
    set((s) => ({ panels: mapPanel(s.panels, panelId, (p) => ({ ...p, transform })) })),

  selectPanel: (panelId) => {
    if (panelId !== null && !get().panels.some((p) => p.id === panelId)) return;
    set({ selectedPanelId: panelId });
  },

  /**
   * Video panels only. Unmuting a panel makes it the audio panel and mutes the
   * rest, so at most one panel is ever unmuted.
   */
  toggleMute: (panelId) => {
    const target = get().panels.find((p) => p.id === panelId);
    if (target?.media?.kind !== "video") return;
    const unmute = target.media.muted;
    set((s) => ({
      panels: s.panels.map((p) =>
        p.media?.kind === "video"
          ? { ...p, media: { ...p.media, muted: p.id === panelId ? !unmute : true } }
          : p,
      ),
      audioPanelId: unmute ? panelId : null,
    }));
  },

  setPlaying: (isPlaying) => set({ playback: { isPlaying } }),

  setExportState: (partial) => set((s) => ({ exportState: { ...s.exportState, ...partial } })),
}));
