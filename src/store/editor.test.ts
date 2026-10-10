import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createInitialState, IDENTITY_TRANSFORM, useEditorStore } from "@/store/editor";
import type { PanelMedia } from "@/types";

function media(kind: "image" | "video", name = "a"): PanelMedia {
  return {
    kind,
    file: new File([""], name),
    objectUrl: `blob:${name}`,
    naturalWidth: 100,
    naturalHeight: 200,
    durationMs: kind === "video" ? 5000 : 0,
    muted: true,
  };
}

const get = () => useEditorStore.getState();

describe("editor store", () => {
  let revoke: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    useEditorStore.setState(createInitialState());
    revoke = vi.fn();
    vi.stubGlobal("URL", { revokeObjectURL: revoke });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("starts with the empty 3-panel default", () => {
    expect(get().layoutId).toBe("3-stacked");
    expect(get().panels).toHaveLength(3);
    expect(get().panels.every((p) => p.media === null)).toBe(true);
    expect(get().selectedPanelId).toBeNull();
    expect(get().audioPanelId).toBeNull();
    expect(get().playback.isPlaying).toBe(false);
    expect(get().exportState.status).toBe("idle");
  });

  it("sets media muted with an identity transform, and revokes the old URL on replace", () => {
    get().setMedia("panel-0", media("image", "one"));
    get().setTransform("panel-0", { scale: 2, offsetX: 0.5, offsetY: 0 });
    get().setMedia("panel-0", { ...media("video", "two"), muted: false });
    const p = get().panels[0]!;
    expect(revoke).toHaveBeenCalledWith("blob:one");
    expect(p.media?.objectUrl).toBe("blob:two");
    expect(p.media?.muted).toBe(true);
    expect(p.transform).toEqual(IDENTITY_TRANSFORM);
  });

  it("removes media, revoking its URL and clearing the audio panel", () => {
    get().setMedia("panel-1", media("video"));
    get().toggleMute("panel-1");
    get().removeMedia("panel-1");
    expect(revoke).toHaveBeenCalledWith("blob:a");
    expect(get().panels[1]?.media).toBeNull();
    expect(get().audioPanelId).toBeNull();
  });

  it("ignores unknown panel ids", () => {
    get().setMedia("nope", media("image"));
    get().selectPanel("nope");
    expect(get().panels.every((p) => p.media === null)).toBe(true);
    expect(get().selectedPanelId).toBeNull();
  });

  it("selects and deselects panels", () => {
    get().selectPanel("panel-2");
    expect(get().selectedPanelId).toBe("panel-2");
    get().selectPanel(null);
    expect(get().selectedPanelId).toBeNull();
  });

  it("allows only one unmuted video panel, and never unmutes images", () => {
    get().setMedia("panel-0", media("video", "v0"));
    get().setMedia("panel-1", media("video", "v1"));
    get().setMedia("panel-2", media("image", "i"));

    get().toggleMute("panel-2");
    expect(get().audioPanelId).toBeNull();
    expect(get().panels[2]?.media?.muted).toBe(true);

    get().toggleMute("panel-0");
    expect(get().audioPanelId).toBe("panel-0");
    get().toggleMute("panel-1");
    expect(get().audioPanelId).toBe("panel-1");
    expect(get().panels[0]?.media?.muted).toBe(true);
    expect(get().panels[1]?.media?.muted).toBe(false);

    get().toggleMute("panel-1");
    expect(get().audioPanelId).toBeNull();
    expect(get().panels[1]?.media?.muted).toBe(true);
  });

  it("keeps media for surviving panels when the layout changes and releases the rest", () => {
    get().setMedia("panel-0", media("image", "k"));
    get().setMedia("panel-2", media("video", "d"));
    get().toggleMute("panel-2");
    get().setTransform("panel-0", { scale: 1.5, offsetX: 0.2, offsetY: -0.2 });
    get().selectPanel("panel-2");

    get().setLayout("2-stacked");
    expect(get().panels).toHaveLength(2);
    expect(get().panels[0]?.media?.objectUrl).toBe("blob:k");
    expect(get().panels[0]?.transform.scale).toBe(1.5);
    expect(revoke).toHaveBeenCalledWith("blob:d");
    expect(get().selectedPanelId).toBeNull();
    expect(get().audioPanelId).toBeNull();

    get().setLayout("4-stacked");
    expect(get().panels).toHaveLength(4);
    expect(get().panels[0]?.media?.objectUrl).toBe("blob:k");
    expect(get().panels[3]?.media).toBeNull();
  });

  it("ignores unknown layouts", () => {
    get().setLayout("nope");
    expect(get().layoutId).toBe("3-stacked");
  });

  it("updates playback and export state", () => {
    get().setPlaying(true);
    expect(get().playback.isPlaying).toBe(true);
    get().setExportState({ status: "exporting", progress: 0.5 });
    get().setExportState({ progress: 0.75 });
    expect(get().exportState).toEqual({ status: "exporting", progress: 0.75, error: null });
  });

  it("keeps state serializable apart from File", () => {
    get().setMedia("panel-0", media("image"));
    const { panels } = get();
    const json = JSON.parse(JSON.stringify(panels)) as typeof panels;
    expect(json[0]?.rect).toEqual(panels[0]?.rect);
  });
});
