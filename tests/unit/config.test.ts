import { describe, it, expect } from "vitest";
import { siteConfig, editorConfig } from "@/lib/config";

describe("siteConfig", () => {
  it("has a name", () => {
    expect(siteConfig.name).toBe("EdgeDocs");
  });

  it("has a description", () => {
    expect(siteConfig.description).toContain("collaborative document editor");
  });

  it("has a url", () => {
    expect(siteConfig.url).toContain("http");
  });
});

describe("editorConfig", () => {
  it("has maxSyncPayloadSize of 1MB", () => {
    expect(editorConfig.maxSyncPayloadSize).toBe(1_048_576);
  });

  it("has maxDocumentSize of 5MB", () => {
    expect(editorConfig.maxDocumentSize).toBe(5_242_880);
  });

  it("has persistenceDebounce", () => {
    expect(editorConfig.persistenceDebounce).toBe(500);
  });

  it("has autoSnapshotInterval", () => {
    expect(editorConfig.autoSnapshotInterval).toBe(50);
  });

  it("has wsTokenExpiry", () => {
    expect(editorConfig.wsTokenExpiry).toBe(300);
  });

  it("has aiRateLimit", () => {
    expect(editorConfig.aiRateLimit).toBe(20);
  });

  it("has sync config", () => {
    expect(editorConfig.sync.initialDelay).toBe(1000);
    expect(editorConfig.sync.maxDelay).toBe(30000);
    expect(editorConfig.sync.backoffMultiplier).toBe(2);
  });
});
