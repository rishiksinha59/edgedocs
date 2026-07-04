import "dotenv/config";
import { Server } from "@hocuspocus/server";
import { Database } from "@hocuspocus/extension-database";
import { jwtVerify } from "jose";
import { neon } from "@neondatabase/serverless";
import * as Y from "yjs";

// Environment validation
const DATABASE_URL = process.env.DATABASE_URL;
const JWT_SECRET = process.env.COLLABORATION_JWT_SECRET;
const PORT = parseInt(process.env.PORT || "1234", 10);

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}
if (!JWT_SECRET) {
  throw new Error("COLLABORATION_JWT_SECRET is required");
}

const sql = neon(DATABASE_URL);
const secretKey = new TextEncoder().encode(JWT_SECRET);

// Maximum sync payload size (1MB)
const MAX_PAYLOAD_SIZE = 1_048_576;

interface TokenPayload {
  userId: string;
  documentId: string;
  role: "owner" | "editor" | "viewer";
}

const server = new Server({
  port: PORT,
  timeout: 30000,
  debounce: 2000,
  maxDebounce: 10000,
  quiet: true,

  async onAuthenticate(data) {
    const { token, documentName, connectionConfig } = data;

    if (!token) {
      throw new Error("Authentication required");
    }

    try {
      const { payload } = await jwtVerify(token, secretKey, {
        algorithms: ["HS256"],
      });

      const tokenData = payload as unknown as TokenPayload;

      // Verify the token is for this specific document
      if (tokenData.documentId !== documentName) {
        throw new Error("Token does not match document");
      }

      // Set read-only for viewers
      if (tokenData.role === "viewer") {
        connectionConfig.readOnly = true;
      }

      // Return context that will be available in other hooks
      return {
        userId: tokenData.userId,
        role: tokenData.role,
      };
    } catch {
      throw new Error("Invalid or expired token");
    }
  },

  async onConnect(data) {
    const { documentName, context } = data;
    const ctx = context as { userId: string; role: string };
    console.log(`[${new Date().toISOString()}] Connected: document=${documentName} role=${ctx?.role || "unknown"}`);
  },

  async onDisconnect(data) {
    const { documentName, context } = data;
    const ctx = context as { userId: string; role: string };
    console.log(`[${new Date().toISOString()}] Disconnected: document=${documentName} user=${ctx.userId}`);
  },

  extensions: [
    new Database({
      async fetch({ documentName }) {
        try {
          const result = await sql`
            SELECT yjs_state FROM documents WHERE id = ${documentName}
          `;

          if (result.length > 0 && result[0].yjs_state) {
            const data = result[0].yjs_state;
            // Neon returns bytea as Buffer or Uint8Array
            if (data instanceof Uint8Array || Buffer.isBuffer(data)) {
              return new Uint8Array(data);
            }
            // Fallback: hex string (e.g. from some drivers)
            if (typeof data === "string") {
              const hex = data as string;
              const cleanHex = hex.startsWith("\\x") ? hex.slice(2) : hex;
              const bytes = new Uint8Array(cleanHex.match(/.{1,2}/g)!.map((byte: string) => parseInt(byte, 16)));
              return bytes;
            }
            return null;
          }

          return null;
        } catch (err) {
          console.error(`Failed to fetch document ${documentName}:`, err);
          return null;
        }
      },

      async store({ documentName, state }) {
        if (state.byteLength > MAX_PAYLOAD_SIZE) {
          console.error(`Rejected oversized state: ${documentName} (${state.byteLength} bytes)`);
          return;
        }

        try {
          const hexState = Buffer.from(state).toString("hex");

          // Compute word count
          const ydoc = new Y.Doc();
          Y.applyUpdate(ydoc, state);
          const text = ydoc.getXmlFragment("default").toJSON();
          const wordCount = text.split(/\s+/).filter(Boolean).length;
          ydoc.destroy();

          await sql`
            UPDATE documents 
            SET yjs_state = ${"\\x" + hexState}::bytea,
                word_count = ${wordCount},
                updated_at = NOW()
            WHERE id = ${documentName}
          `;
        } catch (err) {
          console.error(`Failed to store document ${documentName}:`, err);
        }
      },
    }),
  ],
});

server.listen(PORT).then(() => {
  console.log(`
╔══════════════════════════════════════════════╗
║  EdgeDocs Collaboration Server              ║
║  Running on port ${PORT}                        ║
║  Ready for WebSocket connections            ║
╚══════════════════════════════════════════════╝
  `);
});
