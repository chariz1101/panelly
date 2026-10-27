import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Static privacy audit (SPEC §10): the app's own code never talks to the network.
 * The only exception is Vercel Web Analytics and Speed Insights, which send
 * anonymous page views, performance metrics and export events to this site's
 * own domain, never a file or its contents.
 */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx|css)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

const files = sourceFiles("src").map((path) => ({ path, text: readFileSync(path, "utf8") }));

describe("privacy audit", () => {
  it("scans the source tree", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it("uses no network APIs", () => {
    const network = /\b(fetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource|importScripts)/;
    expect(files.filter((f) => network.test(f.text)).map((f) => f.path)).toEqual([]);
  });

  it("references no external URLs, fonts or scripts", () => {
    const external = /(https?:)?\/\/(?!www\.w3\.org\/)[a-z0-9-]+\.[a-z]{2,}/i;
    const fontImport = /next\/font|@import\s+url|fonts\.(googleapis|gstatic)/;
    const bad = files.filter((f) => external.test(f.text) || fontImport.test(f.text));
    expect(bad.map((f) => f.path)).toEqual([]);
  });

  it("depends on no analytics or tracking packages other than Vercel's own", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
      dependencies?: Record<string, string>;
    };
    const allowed = new Set(["@vercel/analytics", "@vercel/speed-insights"]);
    const tracker =
      /analytics|insights|sentry|segment|mixpanel|posthog|gtag|hotjar|plausible|amplitude/i;
    const deps = Object.keys(pkg.dependencies ?? {});
    expect(deps.filter((d) => tracker.test(d) && !allowed.has(d))).toEqual([]);
  });

  it("sends custom analytics events only from the vetted events module", () => {
    const importsTrack = /from\s+["']@vercel\/analytics["']/;
    expect(files.filter((f) => importsTrack.test(f.text)).map((f) => f.path)).toEqual([
      join("src", "lib", "analytics", "events.ts"),
    ]);
  });
});
