import { auth } from "@/lib/auth";
import { groq } from "@ai-sdk/groq";
import { streamText } from "ai";
import { rateLimit, RATE_LIMITS, rateLimitResponse } from "@/lib/rate-limit";

export const maxDuration = 30;

// POST /api/ai/summarize — Generate document summary
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

  const { content } = await request.json();

  if (!content || typeof content !== "string") {
    return new Response(JSON.stringify({ error: "Content is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Limit input size
  const trimmedContent = content.slice(0, 5000);

  const result = streamText({
    model: groq("llama-3.1-8b-instant"),
    system: `You are a writing assistant. Generate a concise summary of the document. 
Format: Start with a one-sentence TL;DR, then 3-5 bullet points covering key topics. Keep it under 200 words.`,
    prompt: `Summarize this document:

${trimmedContent}`,
    maxOutputTokens: 400,
  });

  return result.toTextStreamResponse();
}
