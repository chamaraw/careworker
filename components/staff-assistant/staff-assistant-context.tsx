"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import type { StaffAssistantChatMessage, StaffAssistantPageRegistration } from "@/lib/staff-assistant-types";
import { mergeStaffAssistantFieldGlossaries, resolveStaffAssistantFlow } from "@/lib/staff-assistant-flows";

type Ctx = {
  open: boolean;
  setOpen: (v: boolean) => void;
  messages: StaffAssistantChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<StaffAssistantChatMessage[]>>;
  sendUserMessage: (text: string, opts?: { mode?: "chat" | "draft_field"; draftFieldId?: string; draftFieldLabel?: string }) => Promise<void>;
  sending: boolean;
  lastSuggestedStep: string | null;
  lastDraftSuggestion: string | null;
  clearDraftSuggestion: () => void;
  sharePreviewAvailable: boolean;
  readSharePreviewDraft: () => string;
  upsertRegistration: (id: string, reg: StaffAssistantPageRegistration | null) => void;
  pendingShare: string | null;
  setPendingShare: (s: string | null) => void;
  insertDraftIntoField: (text: string) => void;
  setDraftApplier: (fn: ((text: string) => void) | null) => void;
};

const StaffAssistantContext = React.createContext<Ctx | null>(null);

export function useStaffAssistant(): Ctx {
  const v = React.useContext(StaffAssistantContext);
  if (!v) throw new Error("useStaffAssistant must be used within StaffAssistantProvider");
  return v;
}

export function useStaffAssistantOptional(): Ctx | null {
  return React.useContext(StaffAssistantContext);
}

/**
 * Register page schema for this surface. Multiple sections on one page use distinct `registrationId`
 * values so glossaries merge instead of overwriting.
 */
export function useRegisterStaffAssistantPage(registrationId: string, registration: StaffAssistantPageRegistration | null) {
  const ctx = React.useContext(StaffAssistantContext);
  const regRef = React.useRef(registration);
  regRef.current = registration;
  const previewRef = React.useRef(registration?.getShareablePreview);
  previewRef.current = registration?.getShareablePreview;
  const flowId = registration?.flowId ?? "";
  const fieldsKey = registration == null ? "null" : JSON.stringify(registration.fields ?? []);
  React.useEffect(() => {
    if (!ctx) return undefined;
    const r = regRef.current;
    if (!r?.flowId) {
      ctx.upsertRegistration(registrationId, null);
      return;
    }
    ctx.upsertRegistration(registrationId, {
      flowId: r.flowId,
      fields: r.fields,
      getShareablePreview: previewRef.current,
    });
    return () => ctx.upsertRegistration(registrationId, null);
  }, [ctx, registrationId, flowId, fieldsKey]);
}

export function StaffAssistantProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = React.useState(false);
  const [messages, setMessages] = React.useState<StaffAssistantChatMessage[]>([]);
  const messagesRef = React.useRef(messages);
  React.useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  const [sending, setSending] = React.useState(false);
  const pageRegsRef = React.useRef(new Map<string, StaffAssistantPageRegistration>());
  const [pendingShare, setPendingShare] = React.useState<string | null>(null);
  const [sharePreviewAvailable, setSharePreviewAvailable] = React.useState(false);
  const [lastSuggestedStep, setLastSuggestedStep] = React.useState<string | null>(null);
  const [lastDraftSuggestion, setLastDraftSuggestion] = React.useState<string | null>(null);
  const draftApplierRef = React.useRef<((text: string) => void) | null>(null);

  const upsertRegistration = React.useCallback((id: string, reg: StaffAssistantPageRegistration | null) => {
    if (reg == null) pageRegsRef.current.delete(id);
    else pageRegsRef.current.set(id, reg);
    let ok = false;
    for (const r of Array.from(pageRegsRef.current.values())) {
      if (r.getShareablePreview) {
        ok = true;
        break;
      }
    }
    setSharePreviewAvailable(ok);
  }, []);

  const readSharePreviewDraft = React.useCallback(() => {
    const parts: string[] = [];
    for (const r of Array.from(pageRegsRef.current.values())) {
      if (!r.getShareablePreview) continue;
      try {
        const s = r.getShareablePreview() ?? "";
        if (s.trim()) parts.push(s.trim());
      } catch {
        /* ignore */
      }
    }
    return parts.join("\n\n---\n\n");
  }, []);

  const collectMergedFields = React.useCallback(() => {
    const flow = resolveStaffAssistantFlow(pathname);
    let merged = mergeStaffAssistantFieldGlossaries(flow.defaultFields, undefined);
    for (const r of Array.from(pageRegsRef.current.values())) {
      merged = mergeStaffAssistantFieldGlossaries(merged, r.fields);
    }
    return merged;
  }, [pathname]);

  const primaryFlowId = React.useCallback(() => {
    const flow = resolveStaffAssistantFlow(pathname);
    for (const r of Array.from(pageRegsRef.current.values())) {
      if (r.flowId) return r.flowId;
    }
    return flow.id;
  }, [pathname]);

  const setDraftApplier = React.useCallback((fn: ((text: string) => void) | null) => {
    draftApplierRef.current = fn;
  }, []);

  const clearDraftSuggestion = React.useCallback(() => setLastDraftSuggestion(null), []);

  const insertDraftIntoField = React.useCallback((text: string) => {
    const fn = draftApplierRef.current;
    if (fn) fn(text);
    setLastDraftSuggestion(null);
  }, []);

  const sendUserMessage = React.useCallback(
    async (text: string, opts?: { mode?: "chat" | "draft_field"; draftFieldId?: string; draftFieldLabel?: string }) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const mode = opts?.mode ?? "chat";
      if (pathname.startsWith("/audits/submit") && mode === "draft_field") {
        return;
      }
      const userMsg: StaffAssistantChatMessage = { role: "user", content: trimmed };
      const nextThread = [...messagesRef.current, userMsg];
      messagesRef.current = nextThread;
      setMessages(nextThread);
      setSending(true);
      setLastSuggestedStep(null);
      if (mode !== "draft_field") setLastDraftSuggestion(null);

      const mergedFields = collectMergedFields();

      try {
        const res = await fetch("/api/staff-assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pathname,
            mode,
            draftFieldId: opts?.draftFieldId,
            draftFieldLabel: opts?.draftFieldLabel,
            messages: nextThread,
            sharedFormSummary: pendingShare ?? undefined,
            pageContext: {
              flowId: primaryFlowId(),
              fields: mergedFields,
            },
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          message?: string;
          suggestedNextStep?: string;
          draftSuggestion?: string;
        };
        if (!res.ok) {
          setMessages((m) => {
            const u = [...m, { role: "assistant" as const, content: data.error ?? "Something went wrong. Try again." }];
            messagesRef.current = u;
            return u;
          });
          return;
        }
        setPendingShare(null);
        setLastSuggestedStep(data.suggestedNextStep?.trim() || null);
        const draft = data.draftSuggestion?.trim();
        if (draft) setLastDraftSuggestion(draft);
        setMessages((m) => {
          const withAssistant = [
            ...m,
            {
              role: "assistant" as const,
              content: data.message?.trim() || "Here is a suggestion based on your question.",
            },
          ];
          messagesRef.current = withAssistant;
          return withAssistant;
        });
      } catch {
        setMessages((m) => {
          const err = [...m, { role: "assistant" as const, content: "Network error. Check your connection and try again." }];
          messagesRef.current = err;
          return err;
        });
      } finally {
        setSending(false);
      }
    },
    [pathname, pendingShare, collectMergedFields, primaryFlowId]
  );

  const value = React.useMemo<Ctx>(
    () => ({
      open,
      setOpen,
      messages,
      setMessages,
      sendUserMessage,
      sending,
      lastSuggestedStep,
      lastDraftSuggestion,
      clearDraftSuggestion,
      sharePreviewAvailable,
      readSharePreviewDraft,
      upsertRegistration,
      pendingShare,
      setPendingShare,
      insertDraftIntoField,
      setDraftApplier,
    }),
    [
      open,
      messages,
      sendUserMessage,
      sending,
      lastSuggestedStep,
      lastDraftSuggestion,
      clearDraftSuggestion,
      sharePreviewAvailable,
      readSharePreviewDraft,
      upsertRegistration,
      pendingShare,
      insertDraftIntoField,
      setDraftApplier,
    ]
  );

  return <StaffAssistantContext.Provider value={value}>{children}</StaffAssistantContext.Provider>;
}

export function useStaffAssistantDraftTarget(args: {
  fieldId: string;
  label: string;
  onApply: (text: string) => void;
}) {
  const argsRef = React.useRef(args);
  argsRef.current = args;
  const ctx = useStaffAssistantOptional();
  React.useEffect(() => {
    if (!ctx) return;
    return () => {
      ctx.setDraftApplier(null);
    };
  }, [ctx, args.fieldId]);

  const requestDraft = React.useCallback(() => {
    if (!ctx) return;
    const a = argsRef.current;
    ctx.setDraftApplier((text) => a.onApply(text));
    ctx.setOpen(true);
    void ctx.sendUserMessage(
      `Draft professional wording for the "${a.label}" field. Keep it short and factual for a UK care provider staff record. Do not include email addresses or passwords.`,
      { mode: "draft_field", draftFieldId: a.fieldId, draftFieldLabel: a.label }
    );
  }, [ctx]);

  return { requestDraft, available: Boolean(ctx) };
}
