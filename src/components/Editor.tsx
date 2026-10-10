"use client";

import { LayoutPicker } from "@/components/LayoutPicker";
import { PreviewCanvas } from "@/components/PreviewCanvas";
import { useEditorStore } from "@/store/editor";

/**
 * Mobile-first editor shell (SPEC §7): canvas, panel controls, bottom bar.
 * No modal or sign-in; the user lands straight in the editor.
 */
export function Editor() {
  const selected = useEditorStore((s) => s.panels.find((p) => p.id === s.selectedPanelId));

  return (
    <div className="mx-auto flex h-dvh w-full max-w-md flex-col">
      <div className="flex min-h-0 flex-1 items-center justify-center p-2">
        <PreviewCanvas />
      </div>

      <section aria-label="Panel controls" className="min-h-14 px-4 py-2 text-sm">
        {selected?.media ? null : (
          <p className="text-center opacity-60">Tap an empty panel to add a photo or video.</p>
        )}
      </section>

      <nav
        aria-label="Editor actions"
        className="flex items-center justify-between gap-2 border-t border-white/10 px-4 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
      >
        <LayoutPicker />
      </nav>
    </div>
  );
}
