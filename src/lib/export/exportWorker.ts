/// <reference lib="webworker" />
import { demuxVideo, DemuxError } from "./demux";
import type { DemuxSummary, ExportEvent, ExportRequest } from "./protocol";

const post = (event: ExportEvent) => self.postMessage(event);

/** Demux every video panel, then report what was found. Encoding builds on this in 4.3+. */
async function run({ job }: Extract<ExportRequest, { type: "start" }>) {
  const panels: DemuxSummary[] = [];
  for (const panel of job.panels) {
    if (panel.media?.kind !== "video") continue;
    const video = await demuxVideo(panel.media.file, job.durationMs);
    panels.push({
      panelId: panel.id,
      codec: video.config.codec,
      sampleCount: video.chunks.length,
      rotation: video.rotation,
    });
  }
  post({ type: "demuxed", panels });
}

self.onmessage = (e: MessageEvent<ExportRequest>) => {
  if (e.data.type !== "start") return;
  run(e.data).catch((err: unknown) => {
    const message =
      err instanceof DemuxError || err instanceof Error ? err.message : "Export failed.";
    post({ type: "error", message });
  });
};
