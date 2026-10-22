import type { SupportEnv } from "@/lib/export/support";

/** Browser features the editor itself needs, whatever the export path (SPEC §6.3). */
const REQUIRED_FEATURES = [
  ["createImageBitmap", "image decoding"],
  ["OffscreenCanvas", "canvas rendering"],
  ["Worker", "background export"],
  ["requestAnimationFrame", "smooth preview"],
] as const;

/** Names of the missing capabilities; empty when the editor can run. */
export function missingEditorFeatures(env: SupportEnv = globalThis): string[] {
  return REQUIRED_FEATURES.filter(([key]) => !(key in env)).map(([, label]) => label);
}

/** True when the browser is modern enough to open the editor at all. */
export function isEditorSupported(env: SupportEnv = globalThis): boolean {
  return missingEditorFeatures(env).length === 0;
}
