/// <reference lib="webworker" />
import { frameCount, OUTPUT_HEIGHT, OUTPUT_WIDTH } from "@/lib/geometry/output";
import type { PanelSource } from "@/lib/render/drawPanel";
import { demuxVideo, DemuxError } from "./demux";
import { pickEncoderConfig } from "./encoderConfig";
import { runFrameLoop } from "./frameLoop";
import { FrameEncoder } from "./frameEncoder";
import { Mp4Mux } from "./mp4Mux";
import { PanelDecoder } from "./panelDecoder";
import type { ExportEvent, ExportRequest } from "./protocol";

const post = (event: ExportEvent) => self.postMessage(event);

/**
 * Decode, composite, encode and mux the project into an MP4 (SPEC §6.1),
 * reporting progress after every encoded frame (SPEC §6.5).
 */
async function run({ job }: Extract<ExportRequest, { type: "start" }>) {
  const decoders = new Map<string, PanelDecoder>();
  const bitmaps: ImageBitmap[] = [];
  const stills = new Map<string, PanelSource>();
  let encoder: FrameEncoder | null = null;

  try {
    for (const panel of job.panels) {
      const media = panel.media;
      if (!media) continue;
      if (media.kind === "video") {
        const video = await demuxVideo(media.file, job.durationMs);
        decoders.set(
          panel.id,
          new PanelDecoder(video, { rotation: video.rotation, scale: media.decodeScale }),
        );
      } else {
        const bitmap = await createImageBitmap(media.file);
        bitmaps.push(bitmap);
        stills.set(panel.id, bitmap);
      }
    }

    const config = await pickEncoderConfig();
    const mux = new Mp4Mux();
    encoder = FrameEncoder.create(config, mux.addChunk);

    const canvas = new OffscreenCanvas(OUTPUT_WIDTH, OUTPUT_HEIGHT);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Couldn't create a canvas to export the video.");

    const framesTotal = frameCount(job.durationMs);
    post({ type: "progress", framesDone: 0, framesTotal });
    await runFrameLoop({
      project: job,
      ctx,
      canvas,
      stills,
      feeds: decoders,
      sink: encoder,
      onProgress: (framesDone, total) => post({ type: "progress", framesDone, framesTotal: total }),
    });
    await encoder.flush();

    post({ type: "done", blob: mux.finish() });
  } finally {
    encoder?.close();
    for (const decoder of decoders.values()) decoder.close();
    for (const bitmap of bitmaps) bitmap.close();
  }
}

self.onmessage = (e: MessageEvent<ExportRequest>) => {
  if (e.data.type !== "start") return;
  run(e.data).catch((err: unknown) => {
    const message =
      err instanceof DemuxError || err instanceof Error ? err.message : "Export failed.";
    post({ type: "error", message });
  });
};
