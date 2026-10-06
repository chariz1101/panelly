/**
 * The fixed output space. All layout geometry is authored in these pixels;
 * on-screen views scale from it at render time only (SPEC §3).
 */
export const OUTPUT_WIDTH = 1080;
export const OUTPUT_HEIGHT = 1920;

/** Hard cap on project duration (SPEC §4). */
export const MAX_DURATION_MS = 15_000;

/** Export frame rate (SPEC §6.1). */
export const OUTPUT_FPS = 30;

/** Number of frames needed to render `durationMs` at OUTPUT_FPS, after applying the 15 s cap. */
export function frameCount(durationMs: number): number {
  const capped = Math.min(Math.max(durationMs, 0), MAX_DURATION_MS);
  return Math.ceil((capped / 1000) * OUTPUT_FPS);
}
