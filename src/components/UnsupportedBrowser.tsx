import { Logo } from "@/components/Logo";

/** Shown instead of the editor on browsers too old to run it (SPEC §6.3). */
export function UnsupportedBrowser({ missing }: { missing: string[] }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <Logo className="mb-4 h-8 w-auto text-white" />
      <h1 className="text-lg font-semibold">Your browser is too old for Panelly</h1>
      <p role="alert" className="text-sm opacity-70">
        Panelly needs a newer browser{missing.length > 0 ? ` (missing: ${missing.join(", ")})` : ""}
        . Please update Chrome, or Safari on iOS 16.4 or later, and open this page again. Your files
        never leave your device.
      </p>
    </div>
  );
}
