import type { ExportEvent, ExportJob, ExportRequest } from "./protocol";

/** A running export. `cancel()` terminates the worker, which frees everything it holds. */
export interface ExportHandle {
  events: AsyncIterable<ExportEvent>;
  cancel: () => void;
}

/**
 * Start an export in a Web Worker so the UI stays responsive (SPEC §6.1).
 * Events stream until the worker reports `error` or the last result; call
 * `cancel()` to stop early.
 */
export function startExport(job: ExportJob): ExportHandle {
  const worker = new Worker(new URL("./exportWorker.ts", import.meta.url), { type: "module" });
  const queue: ExportEvent[] = [];
  let wake: (() => void) | null = null;
  let closed = false;

  const push = (event: ExportEvent) => {
    queue.push(event);
    wake?.();
  };
  worker.onmessage = (e: MessageEvent<ExportEvent>) => push(e.data);
  worker.onerror = (e) => push({ type: "error", message: e.message || "Export failed." });
  worker.onmessageerror = () => push({ type: "error", message: "Export failed." });

  const cancel = () => {
    closed = true;
    worker.terminate();
    wake?.();
  };

  async function* events(): AsyncGenerator<ExportEvent> {
    try {
      while (!closed) {
        const next = queue.shift();
        if (!next) {
          await new Promise<void>((resolve) => (wake = resolve));
          wake = null;
          continue;
        }
        yield next;
        if (next.type === "error" || next.type === "demuxed") return;
      }
    } finally {
      cancel();
    }
  }

  const request: ExportRequest = { type: "start", job };
  worker.postMessage(request);
  return { events: events(), cancel };
}
