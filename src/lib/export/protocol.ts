import type { Project } from "@/types";

/**
 * Everything the export worker needs (SPEC §6.1). `File`s are structured-cloned
 * into the worker; object URLs in `media` are inert there and never used.
 */
export type ExportJob = Pick<Project, "layoutId" | "panels" | "durationMs">;

/** Main thread → worker. */
export type ExportRequest = { type: "start"; job: ExportJob };

/** What demuxing found for one video panel. */
export interface DemuxSummary {
  panelId: string;
  codec: string;
  sampleCount: number;
  /** Source rotation in degrees clockwise (0, 90, 180 or 270). */
  rotation: number;
}

/** Worker → main thread. */
export type ExportEvent =
  { type: "demuxed"; panels: DemuxSummary[] } | { type: "error"; message: string };
