import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CANCEL_GRACE_MS, startExport } from "@/lib/export/exportClient";
import type { ExportEvent, ExportJob, ExportRequest } from "@/lib/export/protocol";

class FakeWorker {
  static last: FakeWorker;
  onmessage: ((e: MessageEvent<ExportEvent>) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;
  onmessageerror: (() => void) | null = null;
  sent: ExportRequest[] = [];
  terminated = false;
  constructor() {
    FakeWorker.last = this;
  }
  postMessage(r: ExportRequest) {
    this.sent.push(r);
  }
  terminate() {
    this.terminated = true;
  }
  emit(event: ExportEvent) {
    this.onmessage?.({ data: event } as MessageEvent<ExportEvent>);
  }
}

const job: ExportJob = { layoutId: "three", panels: [], durationMs: 1000 };

async function collect(it: AsyncIterable<ExportEvent>): Promise<ExportEvent[]> {
  const out: ExportEvent[] = [];
  for await (const e of it) out.push(e);
  return out;
}

describe("startExport", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("Worker", FakeWorker);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("streams events and terminates the worker after done", async () => {
    const handle = startExport(job);
    const worker = FakeWorker.last;
    expect(worker.sent[0]).toEqual({ type: "start", job, bitmaps: {} });
    worker.emit({ type: "progress", framesDone: 1, framesTotal: 2 });
    worker.emit({ type: "done", blob: new Blob() });
    const events = await collect(handle.events);
    expect(events.map((e) => e.type)).toEqual(["progress", "done"]);
    expect(worker.terminated).toBe(true);
  });

  it("cancel asks the worker to stop, then terminates it once it reports cancelled", async () => {
    const handle = startExport(job);
    const worker = FakeWorker.last;
    const collected = collect(handle.events);
    handle.cancel();
    expect(worker.sent[1]).toEqual({ type: "cancel" });
    expect(worker.terminated).toBe(false);
    worker.emit({ type: "cancelled" });
    expect((await collected).map((e) => e.type)).toEqual(["cancelled"]);
    expect(worker.terminated).toBe(true);
  });

  it("terminates an unresponsive worker after the grace period", async () => {
    const handle = startExport(job);
    const worker = FakeWorker.last;
    const collected = collect(handle.events);
    handle.cancel();
    await vi.advanceTimersByTimeAsync(CANCEL_GRACE_MS);
    expect((await collected).map((e) => e.type)).toEqual(["cancelled"]);
    expect(worker.terminated).toBe(true);
  });
});
