export type DeliverResult = "shared" | "downloaded" | "cancelled";

/** The browser APIs delivery touches, injectable so the logic is unit-testable. */
export interface DeliverEnv {
  share?: (data: ShareData) => Promise<void>;
  canShare?: (data: ShareData) => boolean;
  download: (blob: Blob, filename: string) => void;
}

/** Anchor-click download; the object URL is revoked once the browser has started it. */
export function anchorDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function browserDeliverEnv(): DeliverEnv {
  const nav = typeof navigator === "undefined" ? undefined : navigator;
  return {
    share: nav?.share ? (d) => nav.share(d) : undefined,
    canShare: nav?.canShare ? (d) => nav.canShare(d) : undefined,
    download: anchorDownload,
  };
}

/**
 * Hand the exported file to the user (SPEC §1): the Web Share API when the
 * browser can share this file, otherwise a plain download. A dismissed share
 * sheet is "cancelled", not an error; any other share failure falls back to
 * a download so the user never loses the export.
 */
export async function deliverFile(
  blob: Blob,
  filename: string,
  env: DeliverEnv = browserDeliverEnv(),
): Promise<DeliverResult> {
  const file = new File([blob], filename, { type: blob.type });
  const data: ShareData = { files: [file] };
  if (env.share && env.canShare?.(data)) {
    try {
      await env.share(data);
      return "shared";
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return "cancelled";
    }
  }
  env.download(blob, filename);
  return "downloaded";
}

/** True when this browser can hand a file of `mime` to the system share sheet. */
export function canShareFiles(mime: string, env: DeliverEnv = browserDeliverEnv()): boolean {
  if (!env.share || !env.canShare) return false;
  return env.canShare({ files: [new File(["x"], "panelly", { type: mime })] });
}
