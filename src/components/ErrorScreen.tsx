import { Logo } from "@/components/Logo";

/** Fallback UI for the error boundaries: always a way back into the editor (SPEC §8). */
export function ErrorScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <Logo className="mb-4 h-8 w-auto text-white" />
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p role="alert" className="text-sm opacity-70">
        Panelly hit an unexpected problem. Your files never left your device. Try again, or reload
        to start fresh.
      </p>
      <div className="flex w-full gap-2 [&>button]:flex-1">
        <button
          type="button"
          onClick={onRetry}
          className="bg-brand min-h-11 rounded-lg px-4 text-sm font-semibold text-black"
        >
          Try again
        </button>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="min-h-11 rounded-lg border border-white/20 px-4 text-sm font-semibold"
        >
          Reload
        </button>
      </div>
    </main>
  );
}
