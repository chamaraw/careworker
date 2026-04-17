"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { FormAiValidationResult } from "@/lib/audit-form-ai-validate";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

const STEP_LABELS = ["Overview", "Timing & limits", "Actions & notes", "Submit"];

export function AuditAiValidationWizard({
  open,
  onOpenChange,
  loading,
  result,
  onGoBack,
  onSubmitReport,
  pending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  result: FormAiValidationResult | null;
  onGoBack: () => void;
  onSubmitReport: () => void | Promise<void>;
  pending: boolean;
}) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  const maxStep = STEP_LABELS.length - 1;

  let body: ReactNode;
  if (!open) {
    body = null;
  } else if (loading || !result) {
    body = (
      <div className="flex flex-col items-center gap-3 py-6">
        <Loader2 className="h-8 w-8 animate-spin text-[#005EB8]" aria-hidden />
        <p className="text-sm text-muted-foreground text-center">
          Running automatic validation on your entries (no chat). This may take a few seconds.
        </p>
      </div>
    );
  } else if (result.cannot_save) {
    body = (
      <>
        <DialogHeader>
          <DialogTitle className="text-destructive">Report cannot be saved</DialogTitle>
          <DialogDescription>
            Automatic validation found problems that need fixing before this report can be stored.
          </DialogDescription>
        </DialogHeader>
        <ul className="list-disc pl-5 text-sm space-y-2 text-slate-800">
          {result.cannot_save_reasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
        <DialogFooter>
          <Button type="button" className="min-h-[44px] w-full touch-manipulation" variant="outline" onClick={onGoBack}>
            Go back and edit
          </Button>
        </DialogFooter>
      </>
    );
  } else {
    body = (
      <>
        <DialogHeader className="px-4 pt-4 pb-2 shrink-0 border-b border-[#E8EDEE]">
          <DialogTitle className="text-[#005EB8]">Validation review</DialogTitle>
          <DialogDescription>
            Step {step + 1} of {STEP_LABELS.length}: {STEP_LABELS[step]} — you did not type into the AI; this checks what
            you entered.
          </DialogDescription>
        </DialogHeader>

        <div className="px-4 py-3 overflow-y-auto flex-1 min-h-0 text-sm space-y-3">
          {step === 0 ? <p className="text-slate-800 leading-relaxed">{result.summary}</p> : null}
          {step === 1 ? (
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold text-[#005EB8] uppercase tracking-wide">Timing</p>
                <p className="text-slate-800 mt-1 whitespace-pre-wrap">{result.timing_review}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-[#005EB8] uppercase tracking-wide">Values & limits</p>
                <p className="text-slate-800 mt-1 whitespace-pre-wrap">{result.limits_review}</p>
              </div>
            </div>
          ) : null}
          {step === 2 ? (
            <div className="space-y-3">
              {result.field_notes.length > 0 ? (
                <div>
                  <p className="text-xs font-semibold text-slate-600">Field notes</p>
                  <ul className="list-disc pl-5 mt-1 space-y-1 text-slate-800">
                    {result.field_notes.map((n, i) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-muted-foreground">No extra field notes.</p>
              )}
              {result.suggested_actions.length > 0 ? (
                <div>
                  <p className="text-xs font-semibold text-[#007F3B]">Suggested actions (follow local policy)</p>
                  <ul className="list-disc pl-5 mt-1 space-y-1 text-slate-800">
                    {result.suggested_actions.map((n, i) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-muted-foreground">No additional actions suggested.</p>
              )}
            </div>
          ) : null}
          {step === 3 ? (
            <p className="text-slate-800">
              If you are happy with the form, submit the report. You can still go back to change entries first.
            </p>
          ) : null}
        </div>

        <div className="px-4 py-2 border-t border-[#E8EDEE] bg-[#E8EDEE]/30 shrink-0">
          <div className="flex gap-1 flex-wrap">
            {STEP_LABELS.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 flex-1 min-w-[2rem] rounded-full",
                  i <= step ? "bg-[#005EB8]" : "bg-slate-300"
                )}
              />
            ))}
          </div>
        </div>

        <DialogFooter className="px-4 py-3 border-t border-[#E8EDEE] flex-row flex-wrap gap-2 justify-between shrink-0">
          <Button
            type="button"
            variant="outline"
            className="min-h-[44px] touch-manipulation"
            onClick={() => {
              setStep(0);
              onGoBack();
            }}
          >
            Cancel
          </Button>
          <div className="flex gap-2">
            {step > 0 ? (
              <Button
                type="button"
                variant="outline"
                className="min-h-[44px] touch-manipulation"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
              >
                Back
              </Button>
            ) : null}
            {step < maxStep ? (
              <Button
                type="button"
                className="min-h-[44px] touch-manipulation bg-[#005EB8] hover:bg-[#004a94]"
                onClick={() => setStep((s) => Math.min(maxStep, s + 1))}
              >
                Next
              </Button>
            ) : (
              <Button
                type="button"
                className="min-h-[44px] touch-manipulation bg-[#007F3B] hover:bg-[#006b32]"
                disabled={pending}
                onClick={() => void Promise.resolve(onSubmitReport())}
              >
                {pending ? "Saving…" : "Submit report"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </>
    );
  }

  const isBlocking = !!open && !!result?.cannot_save;
  const isWizard = !!open && !!result && !result.cannot_save && !loading;
  const contentClass =
    isWizard
      ? "sm:max-w-lg max-h-[min(90vh,560px)] flex flex-col gap-0 p-0 overflow-hidden"
      : "sm:max-w-md";

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setStep(0);
        onOpenChange(o);
      }}
    >
      {open ? (
        <DialogContent
          className={contentClass}
          showCloseButton={!loading && (!!isBlocking || isWizard)}
        >
          {body}
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
