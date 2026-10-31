/**
 * Settles like `work`, unless it hasn't settled after `ms`: then settles with
 * `fallback()` instead and ignores `work` from then on. Used so a browser
 * event that never fires can't leave an import hanging with no message.
 */
export function withTimeout<T>(
  work: Promise<T>,
  ms: number,
  fallback: () => T | Promise<T>,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      Promise.resolve().then(fallback).then(resolve, reject);
    }, ms);
    work.then(
      (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
