import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Static privacy audit (SPEC §10): nothing in the app may talk to the network. */
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

  it("depends on no analytics or tracking packages", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
      dependencies?: Record<string, string>;
    };
    const tracker = /analytics|sentry|segment|mixpanel|posthog|gtag|hotjar|plausible|amplitude/i;
    expect(Object.keys(pkg.dependencies ?? {}).filter((d) => tracker.test(d))).toEqual([]);
  });
});
