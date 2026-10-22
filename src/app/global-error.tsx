"use client";

import { ErrorScreen } from "@/components/ErrorScreen";
import "./globals.css";

/** Last resort for errors in the root layout itself; renders its own document. */
export default function GlobalError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <ErrorScreen onRetry={retry} />
      </body>
    </html>
  );
}
