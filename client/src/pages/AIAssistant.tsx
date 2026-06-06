import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sparkles, Send, RotateCcw, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { useIndustry } from "@/contexts/IndustryContext";
import { useSubscription } from "@/hooks/useSubscription";
import { UpgradePrompt } from "@/components/UpgradePrompt";

// ─── Types ────────────────────────────────────────────────────────────────────

type Role = "user" | "assistant";

interface Message {
  id: string;
  role: Role;
  content: string;
  timestamp: Date;
}

// ─// ─── Suggested prompts (will be overridden by industry config) ────────────────────────────────────────────────────

const DEFAULT_SUGGESTED_PROMPTS = [
  {
    label: "Follow-up SMS for cold lead",
    prompt: "Draft a follow-up SMS for a lead who has not responded in 3 days",
  },
  {
    label: "Estimate email for exterior repaint",
    prompt: "Write a professional estimate email for an exterior repaint job",
  },
  {
    label: "Pricing for 2400 sqft interior",
    prompt: "What should I charge for a 2400 sqft interior paint job in Dallas",
  },
  {
    label: "Respond to a 3-star review",
    prompt: "Help me respond to a 3-star Google review",
  },
  {
    label: "Job completion thank-you",
    prompt: "Write a job completion thank-you message for a residential client",
  },
  {
    label: "Social media caption",
    prompt: "Create a social media caption for a before and after exterior project",
  },
];

// ─── Markdown-lite renderer ───────────────────────────────────────────────────
// Renders **bold**, *italic*, and newlines without a full markdown library.

function MessageText({ content }: { content: string }) {
  const lines = content.split("\n");
  return (
    <div className="space-y-1 text-sm leading-relaxed">
      {lines.map((line, i) => {
        if (line === "") return <br key={i} />;
        // Bold (**text**) and italic (*text*)
        const parts = line.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
        return (
          <p key={i}>
            {parts.map((part, j) => {
              if (part.startsWith("**") && part.endsWith("**")) {
                return <strong key={j}>{part.slice(2, -2)}</strong>;
              }
              if (part.startsWith("*") && part.endsWith("*")) {
                return <em key={j}>{part.slice(1, -1)}</em>;
              }
              return part;
            })}
          </p>
        );
      })}
    </div>
  );
}

// ─── Copy button ──────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button
      onClick={handleCopy}
      title="Copy to clipboard"
      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted text-muted-foreground"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AIAssistant() {
  const { canAccess } = useSubscription();

  // Feature gate: AI features require 'agency' tier
  if (!canAccess("agency")) {
    return (
      <UpgradePrompt
        requiredTier="agency"
        featureName="AI Assistant"
        description="Get AI-powered help drafting estimates, follow-up messages, and marketing content tailored to your painting business."
      />
    );
  }

  const { user } = useAuth();
  const { industryName, aiSuggestedPrompts, jobTerminology, customerTerminology } = useIndustry();
  const SUGGESTED_PROMPTS = aiSuggestedPrompts;
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const chatMutation = trpc.ai.chat.useMutation({
    onSuccess: (data) => {
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.content,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setIsLoading(false);
    },
    onError: (err) => {
      toast.error(`AI error: ${err.message}`);
      setIsLoading(false);
    },
  });

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  function buildApiMessages(history: Message[]) {
    return history.map((m) => ({ role: m.role, content: m.content }));
  }

  function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      timestamp: new Date(),
    };

    const nextHistory = [...messages, userMessage];
    setMessages(nextHistory);
    setInput("");
    setIsLoading(true);

    chatMutation.mutate({ messages: buildApiMessages(nextHistory) });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  function handleReset() {
    setMessages([]);
    setInput("");
    textareaRef.current?.focus();
  }

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-sm">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">AI Business Assistant</h1>
            <p className="text-xs text-muted-foreground">
              {`Expert advice for your ${industryName?.toLowerCase() || 'business'}`}
            </p>
          </div>
        </div>
        {!isEmpty && (
          <Button variant="ghost" size="sm" onClick={handleReset} className="text-muted-foreground">
            <RotateCcw className="h-4 w-4 mr-1.5" />
            New chat
          </Button>
        )}
      </div>

      {/* Messages area */}
      <ScrollArea className="flex-1 py-4">
        {isEmpty ? (
          /* Empty state with suggested prompts */
          <div className="flex flex-col items-center justify-center h-full gap-6 px-4 py-8">
            <div className="text-center space-y-2">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center mx-auto shadow-md">
                <Sparkles className="h-7 w-7 text-white" />
              </div>
              <h2 className="text-lg font-semibold">How can I help your business today?</h2>
              <p className="text-sm text-muted-foreground max-w-sm">
                {`Ask me anything about running your ${industryName?.toLowerCase() || 'business'} company — from pricing and emails to social media and customer service.`}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-2xl">
              {SUGGESTED_PROMPTS.map((sp: any) => (
                <button
                  key={sp.label}
                  onClick={() => sendMessage(sp.prompt)}
                  className="text-left px-4 py-3 rounded-xl border bg-card hover:bg-muted/60 transition-colors group"
                >
                  <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                    {sp.label}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                    {sp.prompt}
                  </p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Message thread */
          <div className="space-y-6 px-2">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                    <Sparkles className="h-4 w-4 text-white" />
                  </div>
                )}
                <div
                  className={`relative group max-w-[80%] rounded-2xl px-4 py-3 ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-tr-sm"
                      : "bg-muted rounded-tl-sm"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <>
                      <MessageText content={msg.content} />
                      <div className="flex justify-end mt-1.5">
                        <CopyButton text={msg.content} />
                      </div>
                    </>
                  ) : (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>
                {msg.role === "user" && (
                  <Avatar className="h-8 w-8 shrink-0 mt-0.5">
                    <AvatarFallback className="text-xs font-medium">
                      {user?.name?.charAt(0).toUpperCase() ?? "U"}
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))}

            {/* Typing indicator */}
            {isLoading && (
              <div className="flex gap-3 justify-start">
                <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3">
                  <div className="flex gap-1 items-center h-5">
                    <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:0ms]" />
                    <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:150ms]" />
                    <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </ScrollArea>

      {/* Input area */}
      <div className="shrink-0 pt-3 border-t">
        <div className="flex gap-2 items-end">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Ask anything about your ${industryName?.toLowerCase() || 'business'} business… (Enter to send, Shift+Enter for new line)`}
            className="resize-none min-h-[52px] max-h-[160px] text-sm"
            rows={2}
            disabled={isLoading}
          />
          <Button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading}
            size="icon"
            className="h-[52px] w-[52px] shrink-0 bg-gradient-to-br from-violet-500 to-indigo-600 hover:from-violet-600 hover:to-indigo-700 border-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1.5 text-center">
          AI responses are for guidance only. Always use your professional judgment.
        </p>
      </div>
    </div>
  );
}
