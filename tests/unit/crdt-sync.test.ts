/**
 * Tests for Yjs CRDT conflict resolution — the core of EdgeDocs' local-first architecture.
 *
 * These tests verify:
 * 1. Concurrent edits by two clients merge deterministically (no data loss).
 * 2. Merge result is the same regardless of operation application order (commutativity).
 * 3. Offline edits replayed on reconnect produce the same result as if they were real-time.
 * 4. Version snapshots can be captured and restored correctly.
 * 5. Applying the same update twice has no effect (idempotency).
 */
import { describe, it, expect, beforeEach } from "vitest";
import * as Y from "yjs";

// Helper: get the full text from a Yjs doc's "default" XmlFragment (matches TipTap usage)
function getDocText(ydoc: Y.Doc): string {
  return ydoc.getText("content").toString();
}

// Helper: sync two Yjs docs by exchanging state updates (simulates WebSocket sync)
function syncDocs(docA: Y.Doc, docB: Y.Doc) {
  const stateA = Y.encodeStateAsUpdate(docA);
  const stateB = Y.encodeStateAsUpdate(docB);
  Y.applyUpdate(docA, stateB);
  Y.applyUpdate(docB, stateA);
}

describe("Yjs CRDT — Conflict Resolution", () => {
  let clientA: Y.Doc;
  let clientB: Y.Doc;

  beforeEach(() => {
    clientA = new Y.Doc();
    clientB = new Y.Doc();

    // Start both docs from the same initial state
    clientA.getText("content").insert(0, "Hello world");
    syncDocs(clientA, clientB);
  });

  it("both clients see identical text after initial sync", () => {
    expect(getDocText(clientA)).toBe("Hello world");
    expect(getDocText(clientB)).toBe("Hello world");
  });

  it("concurrent insertions at different positions merge without data loss", () => {
    // Client A inserts at the beginning
    clientA.getText("content").insert(0, "Dear ");
    // Client B appends at the end
    clientB.getText("content").insert(11, "!");

    syncDocs(clientA, clientB);

    const textA = getDocText(clientA);
    const textB = getDocText(clientB);

    // Both must converge to the same result
    expect(textA).toBe(textB);
    // Both insertions must be present
    expect(textA).toContain("Dear ");
    expect(textA).toContain("!");
  });

  it("concurrent insertions at the SAME position converge deterministically", () => {
    // Both clients insert at position 5 simultaneously
    clientA.getText("content").insert(5, " [A]");
    clientB.getText("content").insert(5, " [B]");

    syncDocs(clientA, clientB);

    const textA = getDocText(clientA);
    const textB = getDocText(clientB);

    // Must converge — exact order depends on clientID, but both see the same thing
    expect(textA).toBe(textB);
    expect(textA).toContain("[A]");
    expect(textA).toContain("[B]");
  });

  it("merge is commutative — same result regardless of sync direction", () => {
    clientA.getText("content").insert(5, " alpha");
    clientB.getText("content").insert(5, " beta");

    // Simulate different sync orders
    const doc1 = new Y.Doc();
    const doc2 = new Y.Doc();
    // Start from clean state
    Y.applyUpdate(doc1, Y.encodeStateAsUpdate(clientA));
    Y.applyUpdate(doc1, Y.encodeStateAsUpdate(clientB));
    // Reverse order
    Y.applyUpdate(doc2, Y.encodeStateAsUpdate(clientB));
    Y.applyUpdate(doc2, Y.encodeStateAsUpdate(clientA));

    expect(doc1.getText("content").toString()).toBe(doc2.getText("content").toString());

    doc1.destroy();
    doc2.destroy();
  });

  it("applying the same update twice is idempotent", () => {
    clientA.getText("content").insert(5, " extra");
    const update = Y.encodeStateAsUpdate(clientA);

    Y.applyUpdate(clientB, update);
    const textAfterFirst = getDocText(clientB);
    Y.applyUpdate(clientB, update); // apply again
    const textAfterSecond = getDocText(clientB);

    expect(textAfterFirst).toBe(textAfterSecond);
  });

  it("concurrent deletions do not cause double-delete", () => {
    // Both clients delete the word "world"
    clientA.getText("content").delete(6, 5); // delete "world"
    clientB.getText("content").delete(6, 5); // same delete

    syncDocs(clientA, clientB);

    const textA = getDocText(clientA);
    const textB = getDocText(clientB);

    expect(textA).toBe(textB);
    expect(textA).toBe("Hello ");
  });
});

describe("Yjs — Offline Sync Simulation", () => {
  it("offline edits are merged correctly on reconnect", () => {
    const server = new Y.Doc();
    const client = new Y.Doc();

    // Initial sync
    server.getText("content").insert(0, "Document text");
    Y.applyUpdate(client, Y.encodeStateAsUpdate(server));

    // Client goes offline and edits
    client.getText("content").insert(9, " (edited)");

    // Server receives edits from another user
    server.getText("content").insert(13, " v2");

    // Client comes back online — sync
    syncDocs(server, client);

    const serverText = server.getText("content").toString();
    const clientText = client.getText("content").toString();

    expect(serverText).toBe(clientText);
    expect(serverText).toContain("(edited)");
    expect(serverText).toContain("v2");

    server.destroy();
    client.destroy();
  });
});

describe("Yjs — Version Snapshot & Restore", () => {
  it("captures a snapshot and restores it", () => {
    const doc = new Y.Doc();
    doc.getText("content").insert(0, "Version 1 content");

    // Capture snapshot (this is exactly how the app does it)
    const snapshot = Y.encodeStateAsUpdate(doc);

    // Edit the doc further
    doc.getText("content").delete(0, 17);
    doc.getText("content").insert(0, "Version 2 completely different");
    expect(getDocText(doc)).toBe("Version 2 completely different");

    // Restore by creating a new doc from the snapshot
    const restored = new Y.Doc();
    Y.applyUpdate(restored, snapshot);
    expect(restored.getText("content").toString()).toBe("Version 1 content");

    doc.destroy();
    restored.destroy();
  });

  it("state vectors enable efficient differential sync", () => {
    const doc = new Y.Doc();
    doc.getText("content").insert(0, "Hello");

    // Capture the full state and its state vector at this point
    const initialState = Y.encodeStateAsUpdate(doc);
    const stateVector = Y.encodeStateVector(doc);

    // Edit further
    doc.getText("content").insert(5, " World");

    // Diff since the snapshot — only the new " World" update
    const diff = Y.encodeStateAsUpdate(doc, stateVector);
    expect(diff.byteLength).toBeGreaterThan(0);

    // Apply the initial state to a fresh doc, then apply only the diff
    const receiver = new Y.Doc();
    Y.applyUpdate(receiver, initialState);
    expect(receiver.getText("content").toString()).toBe("Hello");

    Y.applyUpdate(receiver, diff);
    expect(receiver.getText("content").toString()).toBe("Hello World");

    doc.destroy();
    receiver.destroy();
  });
});

describe("Yjs — Payload Size Safety", () => {
  const MAX_PAYLOAD_SIZE = 1_048_576; // 1MB — matches server constant

  it("normal documents are well under the 1MB limit", () => {
    const doc = new Y.Doc();
    // ~50 KB of text (generous for a document)
    doc.getText("content").insert(0, "x".repeat(50_000));
    const state = Y.encodeStateAsUpdate(doc);

    expect(state.byteLength).toBeLessThan(MAX_PAYLOAD_SIZE);
    doc.destroy();
  });

  it("an excessively large document exceeds the limit and would be rejected", () => {
    const doc = new Y.Doc();
    // Insert 2MB of text — should produce a state larger than 1MB
    doc.getText("content").insert(0, "x".repeat(2_000_000));
    const state = Y.encodeStateAsUpdate(doc);

    expect(state.byteLength).toBeGreaterThan(MAX_PAYLOAD_SIZE);
    doc.destroy();
  });
});
