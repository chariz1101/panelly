import { describe, expect, it } from "vitest";
import {
  interruptedImport,
  interruptedImportMessage,
  markImportEnd,
  markImportStart,
} from "./importGuard";

const memoryStore = () => {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
};

describe("importGuard", () => {
  it("reports an import that started but never ended", () => {
    const store = memoryStore();
    markImportStart({ size: 150 * 1024 * 1024 }, store);
    expect(interruptedImport(store)).toEqual({ sizeMb: 150 });
    expect(interruptedImportMessage({ sizeMb: 150 })).toMatch(/reloaded.*150 MB/);
  });

  it("reports nothing once the import ends", () => {
    const store = memoryStore();
    markImportStart({ size: 1024 }, store);
    markImportEnd(store);
    expect(interruptedImport(store)).toBeNull();
  });

  it("does nothing when storage is unavailable or broken", () => {
    const broken = {
      getItem: () => "{not json",
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    expect(() => markImportStart({ size: 1 }, broken)).not.toThrow();
    expect(() => markImportEnd(broken)).not.toThrow();
    expect(interruptedImport(broken)).toBeNull();
    expect(interruptedImport(null)).toBeNull();
  });
});
