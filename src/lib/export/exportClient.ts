import type { ExportEvent, ExportJob, ExportRequest } from "./protocol";

/** How long a cancelled worker gets to close its resources before it is terminated anyway. */
export const CANCEL_GRACE_MS = 1000;

/** A running export. */
export interface ExportHandle {
  events: AsyncIterable<ExportEvent>;
  /**
   * Ask the worker to stop. It closes every decoder, the encoder and any
   * outstanding `VideoFrame`, reports `cancelled`, and is then terminated
   * (forcibly after `CANCEL_GRACE_MS` if it doesn't answer).
   */
  cancel: () => void;
}

/**
 * Start an export in a Web Worker so the UI stays responsive (SPEC §6.1).
 * Events stream until the worker reports `error`, `done` or `cancelled`.
 */
export function startExport(job: ExportJob): ExportHandle {
  const worker = new Worker(new URL("./exportWorker.ts", import.meta.url), { type: "module" });
  const queue: ExportEvent[] = [];
  let wake: (() => void) | null = null;
  let graceTimer: ReturnType<typeof setTimeout> | undefined;

  const push = (event: ExportEvent) => {
    queue.push(event);
    wake?.();
  };
  worker.onmessage = (e: MessageEvent<ExportEvent>) => push(e.data);
  worker.onerror = (e) => push({ type: "error", message: e.message || "Export failed." });
  worker.onmessageerror = () => push({ type: "error", message: "Export failed." });

  const terminate = () => {
    clearTimeout(graceTimer);
    worker.terminate();
  };

  const cancel = () => {
    const request: ExportRequest = { type: "cancel" };
    worker.postMessage(request);
    clearTimeout(graceTimer);
    graceTimer = setTimeout(() => push({ type: "cancelled" }), CANCEL_GRACE_MS);
  };

  async function* events(): AsyncGenerator<ExportEvent> {
    try {
      for (;;) {
        const next = queue.shift();
        if (!next) {
          await new Promise<void>((resolve) => (wake = resolve));
          wake = null;
          continue;
        }
        yield next;
        if (next.type !== "progress") return;
      }
    } finally {
      terminate();
    }
  }

  const request: ExportRequest = { type: "start", job };
  worker.postMessage(request);
  return { events: events(), cancel };
}
