"use client";

import { useSyncExternalStore } from "react";
import { Editor } from "@/components/Editor";
import { UnsupportedBrowser } from "@/components/UnsupportedBrowser";
import { missingEditorFeatures } from "@/lib/export/editorSupport";

/** Capabilities never change at runtime, so there is nothing to subscribe to. */
const subscribeNever = () => () => {};
/** Joined string keeps the snapshot referentially stable. */
const readMissing = () => missingEditorFeatures().join("|");

/** Renders the editor only on browsers able to run it; otherwise a friendly message. */
export function EditorGate() {
  const missing = useSyncExternalStore(subscribeNever, readMissing, () => null);
  if (missing === null) return null;
  if (missing !== "") return <UnsupportedBrowser missing={missing.split("|")} />;
  return <Editor />;
}
