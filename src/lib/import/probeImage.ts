import type { PanelMedia } from "@/types";

/**
 * Loads an image file into an offscreen `<img>`, reads its natural size and
 * returns a `PanelMedia` that owns a fresh object URL (SPEC §5.2). The caller
 * hands it to the store, which revokes the URL on replace/remove.
 */
export function probeImage(file: File): Promise<PanelMedia> {
  const objectUrl = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth === 0 || img.naturalHeight === 0) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("That image has no size."));
        return;
      }
      resolve({
        kind: "image",
        file,
        objectUrl,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        durationMs: 0,
        muted: true,
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("That image couldn't be read. It may be corrupt or unsupported."));
    };
    img.src = objectUrl;
  });
}
