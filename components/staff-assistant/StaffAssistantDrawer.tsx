"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useStaffAssistant } from "@/components/staff-assistant/staff-assistant-context";
import { resolveStaffAssistantFlow, STAFF_ASSISTANT_QUICK_INTENTS } from "@/lib/staff-assistant-flows";

export function StaffAssistantDrawer() {
  const pathname = usePathname() ?? "/";
  const isFormSubmitRoute = pathname.startsWith("/audits/submit");
  const flow = resolveStaffAssistantFlow(pathname);
  const {
    open,
    setOpen,
    messages,
    sendUserMessage,
    sending,
    lastSuggestedStep,
    lastDraftSuggestion,
    insertDraftIntoField,
    clearDraftSuggestion,
    sharePreviewAvailable,
    readSharePreviewDraft,
    pendingShare,
    setPendingShare,
    setMessages,
  } = useStaffAssistant();

  const [input, setInput] = React.useState("");
  const [shareOpen, setShareOpen] = React.useState(false);
  const [shareDraft, setShareDraft] = React.useState("");

  const injectWhereLinks = React.useCallback(() => {
    const md = flow.links.map((l) => `[${l.label}](${l.href})`).join(" · ");
    setMessages((m) => [
      ...m,
      {
        role: "assistant",
        content: `Quick links for **${flow.title}**:\n\n${md}\n\nTap a link in the sidebar or use these paths in the app.`,
      },
    ]);
  }, [flow.links, flow.title, setMessages]);

  const openSharePrep = React.useCallback(() => {
    setShareDraft(readSharePreviewDraft());
    setShareOpen(true);
  }, [readSharePreviewDraft]);

  const confirmShare = React.useCallback(() => {
    setPendingShare(shareDraft.trim() || null);
    setShareOpen(false);
  }, [shareDraft, setPendingShare]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const t = input.trim();
    if (!t || sending) return;
    setInput("");
    await sendUserMessage(t);
  }

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0 gap-0">
          <SheetHeader className="p-4 border-b border-[#E8EDEE] shrink-0 text-left">
            <SheetTitle className="text-[#005EB8]">Help assistant</SheetTitle>
            <SheetDescription className="text-left">
              {isFormSubmitRoute
                ? "Explain this form — navigation and what each part means. Use the guided steps on the page to enter answers; this panel does not fill fields for you."
                : `${flow.title} — plain-language guidance. Nothing is saved automatically.`}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {isFormSubmitRoute ? (
              <div className="mx-3 mt-3 rounded-lg border border-[#005EB8]/25 bg-[#E8F4FC]/60 p-3 text-sm text-slate-800 leading-relaxed shrink-0">
                <strong className="text-[#005EB8]">On this screen</strong> use the <strong>guided form</strong> for taps
                and short answers. Open this panel only if you need plain-language help with what the form is asking.
              </div>
            ) : null}
            <div className="p-3 border-b border-[#E8EDEE] space-y-2 shrink-0">
              <p className="text-xs font-medium text-muted-foreground">
                {isFormSubmitRoute ? "Quick help" : "What are you trying to do?"}
              </p>
              <div className="flex flex-wrap gap-2">
                {isFormSubmitRoute ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-[44px] touch-manipulation rounded-full border-[#005EB8]/30 text-[#005EB8]"
                    disabled={sending}
                    onClick={() =>
                      void sendUserMessage(
                        "Explain what this form is asking, in simple order, and what I should have ready before I submit. Do not invent answers for me."
                      )
                    }
                  >
                    Explain this form
                  </Button>
                ) : (
                  STAFF_ASSISTANT_QUICK_INTENTS.map((c) => (
                    <Button
                      key={c.id}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-h-[44px] touch-manipulation rounded-full border-[#005EB8]/30 text-[#005EB8]"
                      disabled={sending}
                      onClick={() => void sendUserMessage(c.prompt)}
                    >
                      {c.label}
                    </Button>
                  ))
                )}
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="min-h-[44px]"
                  onClick={injectWhereLinks}
                >
                  Show me where
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="min-h-[44px]"
                  onClick={() => {
                    setMessages([]);
                    clearDraftSuggestion();
                  }}
                >
                  Clear chat
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
              {messages.length === 0 && (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Ask in your own words, or tap a chip above. Use{" "}
                  <strong className="text-foreground">Show me where</strong> for links to this area of the app.
                </p>
              )}
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={
                    m.role === "user"
                      ? "ml-6 rounded-lg bg-[#E8F4FC] p-3 text-sm"
                      : "mr-4 rounded-lg border border-[#E8EDEE] bg-white p-3 text-sm whitespace-pre-wrap"
                  }
                >
                  {m.role === "assistant" ? <AssistantBody text={m.content} /> : m.content}
                </div>
              ))}
              {sending && <p className="text-xs text-muted-foreground">Thinking…</p>}
            </div>

            {lastSuggestedStep && (
              <div className="mx-3 mb-2 rounded-md border border-[#00A499]/40 bg-[#00A499]/5 p-3 text-sm shrink-0">
                <p className="text-xs font-semibold text-[#005EB8] uppercase tracking-wide">Suggested next step</p>
                <p className="mt-1 text-foreground leading-relaxed">{lastSuggestedStep}</p>
              </div>
            )}

            {lastDraftSuggestion && (
              <div className="mx-3 mb-2 rounded-md border border-[#005EB8]/30 bg-[#E8F4FC]/40 p-3 text-sm shrink-0 space-y-2">
                <p className="text-xs font-semibold text-[#005EB8]">Suggested text (review before inserting)</p>
                <p className="whitespace-pre-wrap text-foreground leading-relaxed">{lastDraftSuggestion}</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="lg"
                    className="min-h-[48px] bg-[#007F3B] hover:bg-[#006b32] text-white"
                    onClick={() => insertDraftIntoField(lastDraftSuggestion)}
                  >
                    Insert into field
                  </Button>
                  <Button type="button" variant="outline" size="lg" className="min-h-[48px]" onClick={clearDraftSuggestion}>
                    Dismiss
                  </Button>
                </div>
              </div>
            )}

            <div className="p-3 border-t border-[#E8EDEE] space-y-2 shrink-0 bg-[var(--background)]">
              {pendingShare && (
                <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-md p-2">
                  Optional answers will be included with your <strong>next</strong> message only (then cleared).
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-[44px]"
                  disabled={!sharePreviewAvailable}
                  onClick={openSharePrep}
                >
                  Share page answers (review first)
                </Button>
              </div>
              <form onSubmit={handleSend} className="space-y-2">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type your question…"
                  className="min-h-[100px] text-base touch-pan-y resize-none"
                  disabled={sending}
                />
                <Button type="submit" size="lg" className="w-full min-h-[48px] bg-[#005EB8] hover:bg-[#004a93]" disabled={sending}>
                  {sending ? "Sending…" : "Send"}
                </Button>
              </form>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {shareOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="staff-assistant-share-title"
        >
          <div className="w-full max-w-lg rounded-lg bg-background border shadow-lg p-4 space-y-3">
            <h2 id="staff-assistant-share-title" className="text-lg font-semibold text-[#005EB8]">
              Review before sharing
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Edit this text to remove anything you do not want the assistant to see. It will only be sent with your next
              message.
            </p>
            <Textarea
              value={shareDraft}
              onChange={(e) => setShareDraft(e.target.value)}
              className="min-h-[160px] text-base"
            />
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" size="lg" className="min-h-[48px]" onClick={() => setShareOpen(false)}>
                Cancel
              </Button>
              <Button type="button" size="lg" className="min-h-[48px] bg-[#005EB8]" onClick={confirmShare}>
                Attach to next send
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Minimal markdown: [label](href) → Link */
function AssistantBody({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  const re = /\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      parts.push(<span key={key++}>{text.slice(last, m.index)}</span>);
    }
    const label = m[1];
    const href = m[2];
    if (href.startsWith("/") || href.startsWith("#")) {
      parts.push(
        <Link key={key++} href={href} className="font-medium text-[#005EB8] underline underline-offset-2">
          {label}
        </Link>
      );
    } else {
      parts.push(
        <a key={key++} href={href} className="font-medium text-[#005EB8] underline">
          {label}
        </a>
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    parts.push(<span key={key++}>{text.slice(last)}</span>);
  }
  return <>{parts}</>;
}
