import { auth } from "@/lib/auth";
import { groq } from "@ai-sdk/groq";
import { streamText } from "ai";
import { rateLimit, RATE_LIMITS, getClientIp, rateLimitResponse } from "@/lib/rate-limit";

export const maxDuration = 30;

// POST /api/ai/complete — AI text completion/continuation
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "Authentication required" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Rate limit by user ID
  const rl = rateLimit(`ai:${session.user.id}`, RATE_LIMITS.ai);
  if (!rl.success) return rateLimitResponse(rl.resetAt);

  const { prompt, context } = await request.json();

  if (!prompt || typeof prompt !== "string") {
    return new Response(JSON.stringify({ error: "Prompt is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Limit context size to prevent abuse
  const trimmedContext = (context || "").slice(-3000);
  const trimmedPrompt = prompt.slice(0, 1000);

  const result = streamText({
    model: groq("llama-3.1-8b-instant"),
    system: `You are a writing assistant for a document editor. Continue writing naturally based on the context provided. 
Keep the same tone, style, and formatting. Write 1-3 paragraphs at most. Do not include any meta-commentary or instructions.`,
    prompt: `Document context (preceding text):
---
${trimmedContext}
---

Continue writing from here: ${trimmedPrompt}`,
    maxOutputTokens: 500,
  });

  return result.toTextStreamResponse();
}
