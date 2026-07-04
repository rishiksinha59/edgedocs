import { auth } from "@/lib/auth";
import { groq } from "@ai-sdk/groq";
import { streamText } from "ai";
import { rateLimit, RATE_LIMITS, rateLimitResponse } from "@/lib/rate-limit";

export const maxDuration = 30;

// POST /api/ai/improve — Improve/fix selected text
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

  const { text, action } = await request.json();

  if (!text || typeof text !== "string") {
    return new Response(JSON.stringify({ error: "Text is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Limit input size
  const trimmedText = text.slice(0, 3000);

  const instructions: Record<string, string> = {
    grammar: "Fix grammar, spelling, and punctuation errors. Keep the meaning identical. Return only the corrected text.",
    improve: "Improve clarity, conciseness, and readability. Keep the same meaning and tone. Return only the improved text.",
    shorten: "Make this text more concise while preserving the key meaning. Return only the shortened text.",
    expand: "Expand this text with more detail and depth while keeping the same tone. Return only the expanded text.",
    professional: "Rewrite in a professional, formal tone. Return only the rewritten text.",
    casual: "Rewrite in a casual, conversational tone. Return only the rewritten text.",
  };

  const instruction = instructions[action] || instructions.improve;

  const result = streamText({
    model: groq("llama-3.1-8b-instant"),
    system: `You are a writing assistant. Follow the instruction exactly. Return ONLY the modified text, no explanations, no quotes, no markdown formatting unless the original had it.`,
    prompt: `Instruction: ${instruction}

Text to modify:
${trimmedText}`,
    maxOutputTokens: 2000,
  });

  return result.toTextStreamResponse();
}
