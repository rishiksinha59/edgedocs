"use client";

import { useState } from "react";
import { Sparkles, X, Wand2, FileText, ArrowRight, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Editor } from "@tiptap/react";

interface AIAssistantProps {
  editor: Editor | null;
  isOpen: boolean;
  onClose: () => void;
}

type AIAction = "complete" | "grammar" | "improve" | "shorten" | "expand" | "professional" | "casual" | "summarize";

async function streamResponse(res: Response, onChunk: (text: string) => void) {
  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let accumulated = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    accumulated += chunk;
    onChunk(accumulated);
  }
  return accumulated;
}

export function AIAssistant({ editor, isOpen, onClose }: AIAssistantProps) {
  const [result, setResult] = useState<string>("");
  const [activeAction, setActiveAction] = useState<AIAction | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const getSelectedText = () => {
    if (!editor) return "";
    const { from, to } = editor.state.selection;
    return editor.state.doc.textBetween(from, to, " ");
  };

  const getDocumentText = () => {
    if (!editor) return "";
    return editor.state.doc.textContent;
  };

  const getContextBeforeCursor = () => {
    if (!editor) return "";
    const { from } = editor.state.selection;
    return editor.state.doc.textBetween(0, from, " ");
  };

  const handleContinueWriting = async () => {
    if (!editor) return;
    setActiveAction("complete");
    setResult("");
    setIsProcessing(true);

    try {
      // Use end of selection (or cursor) to get all preceding text
      const { to } = editor.state.selection;
      const context = editor.state.doc.textBetween(0, to, " ");

      if (!context.trim()) {
        setResult("Please write some text first, then click Continue writing.");
        setIsProcessing(false);
        return;
      }

      const lastSentence = context.split(/[.!?]\s/).pop() || context.slice(-200);

      const res = await fetch("/api/ai/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: lastSentence, context: context.slice(-2000) }),
      });

      if (!res.ok) throw new Error("Request failed");

      const text = await streamResponse(res, setResult);
      if (!text) setResult("No completion generated. Try writing more context first.");
    } catch (err) {
      console.error("AI completion failed:", err);
      setResult("Failed to generate completion. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImproveText = async (action: AIAction) => {
    if (!editor) return;
    const selectedText = getSelectedText();
    if (!selectedText) {
      setResult("Please select some text first.");
      setActiveAction(action);
      return;
    }

    setActiveAction(action);
    setResult("");
    setIsProcessing(true);

    try {
      const res = await fetch("/api/ai/improve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: selectedText, action }),
      });

      if (!res.ok) throw new Error("Request failed");
      await streamResponse(res, setResult);
    } catch (err) {
      console.error("AI improve failed:", err);
      setResult("Failed to process text. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSummarize = async () => {
    if (!editor) return;
    setActiveAction("summarize");
    setResult("");
    setIsProcessing(true);

    try {
      const content = getDocumentText();
      if (!content.trim()) {
        setResult("Document is empty.");
        setIsProcessing(false);
        return;
      }

      const res = await fetch("/api/ai/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      if (!res.ok) throw new Error("Request failed");
      await streamResponse(res, setResult);
    } catch (err) {
      console.error("AI summarize failed:", err);
      setResult("Failed to summarize. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const insertResult = () => {
    if (!editor || !result) return;
    // Don't insert error messages
    if (result.startsWith("Failed to") || result.startsWith("Please")) return;

    if (activeAction === "complete" || activeAction === "summarize") {
      // Insert at cursor position
      editor.chain().focus().insertContent(result).run();
    } else {
      // Replace selection with improved text
      const { from, to } = editor.state.selection;
      if (from !== to) {
        editor.chain().focus().deleteRange({ from, to }).insertContentAt(from, result).run();
      } else {
        editor.chain().focus().insertContent(result).run();
      }
    }

    setResult("");
    setActiveAction(null);
  };

  if (!isOpen) return null;

  return (
    <div className="flex h-full w-80 flex-col border-l bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-purple-500" />
          <h3 className="text-sm font-semibold">AI Assistant</h3>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Actions */}
      <div className="space-y-1 border-b px-3 py-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground uppercase">Writing</p>
        <button onClick={handleContinueWriting} disabled={isProcessing} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted transition-colors disabled:opacity-50">
          <ArrowRight className="h-3.5 w-3.5 text-purple-500" />
          Continue writing
        </button>
        <button onClick={handleSummarize} disabled={isProcessing} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted transition-colors disabled:opacity-50">
          <FileText className="h-3.5 w-3.5 text-purple-500" />
          Summarize document
        </button>

        <p className="mb-2 mt-3 text-xs font-medium text-muted-foreground uppercase">Edit Selection</p>
        {(
          [
            ["grammar", "Fix grammar & spelling"],
            ["improve", "Improve clarity"],
            ["shorten", "Make shorter"],
            ["expand", "Expand with detail"],
            ["professional", "Professional tone"],
            ["casual", "Casual tone"],
          ] as const
        ).map(([action, label]) => (
          <button key={action} onClick={() => handleImproveText(action)} disabled={isProcessing} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted transition-colors disabled:opacity-50">
            <Wand2 className="h-3.5 w-3.5 text-purple-500" />
            {label}
          </button>
        ))}
      </div>

      {/* Result area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {isProcessing && (
          <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Processing...
          </div>
        )}

        {result && (
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto px-4 py-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                {activeAction === "complete" && "Continuation:"}
                {activeAction === "summarize" && "Summary:"}
                {activeAction && !["complete", "summarize"].includes(activeAction) && "Suggested edit:"}
              </p>
              <div className="rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap">{result}</div>
            </div>

            <div className="flex gap-2 border-t px-4 py-3">
              <Button size="sm" onClick={insertResult} className="flex-1">
                <Check className="mr-1.5 h-3.5 w-3.5" />
                {activeAction === "summarize" ? "Insert" : activeAction === "complete" ? "Insert" : "Replace"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setResult("");
                  setActiveAction(null);
                }}
              >
                Discard
              </Button>
            </div>
          </div>
        )}

        {!result && !isProcessing && (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
            <Sparkles className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground">Select text and choose an action, or use &quot;Continue writing&quot; to generate new content at your cursor.</p>
          </div>
        )}
      </div>
    </div>
  );
}
