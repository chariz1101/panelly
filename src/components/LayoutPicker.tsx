"use client";

import { LAYOUTS } from "@/lib/geometry/layouts";
import { useEditorStore } from "@/store/editor";

export function LayoutPicker() {
  const layoutId = useEditorStore((s) => s.layoutId);
  const setLayout = useEditorStore((s) => s.setLayout);

  return (
    <div role="group" aria-label="Layout" className="flex gap-2">
      {LAYOUTS.map((layout) => (
        <button
          key={layout.id}
          type="button"
          aria-pressed={layout.id === layoutId}
          onClick={() => setLayout(layout.id)}
          className="min-h-11 min-w-11 rounded-lg bg-white/10 px-3 text-sm font-medium aria-pressed:bg-white aria-pressed:text-black"
        >
          {layout.panels.length}
        </button>
      ))}
    </div>
  );
}
