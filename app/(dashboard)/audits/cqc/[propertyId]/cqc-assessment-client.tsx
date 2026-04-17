"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createCqcAssessment } from "../../actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";

type Framework = { keyQuestion: "SAFE" | "EFFECTIVE" | "CARING" | "RESPONSIVE" | "WELL_LED"; title: string; subAreas: { id: string; title: string }[] }[];

export function CqcAssessmentClient({ propertyId, framework }: { propertyId: string; framework: Framework }) {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [scores, setScores] = useState<Record<string, number>>({});
  const [pending, setPending] = useState(false);

  const scoreRows = framework.flatMap((section) =>
    section.subAreas.map((sub) => ({
      keyQuestion: section.keyQuestion,
      subArea: sub.title,
      score: scores[sub.id] ?? 3,
    }))
  );

  return (
    <div className="space-y-4">
      {framework.map((section) => (
        <div key={section.keyQuestion} className="rounded border p-3 space-y-2">
          <h3 className="font-semibold">{section.keyQuestion} - {section.title}</h3>
          {section.subAreas.map((sub) => (
            <div key={sub.id} className="flex items-center justify-between gap-2">
              <span className="text-sm">{sub.title}</span>
              <Select
                value={String(scores[sub.id] ?? 3)}
                onValueChange={(v) => setScores((s) => ({ ...s, [sub.id]: parseInt(v ?? "3", 10) }))}
              >
                <SelectTrigger>{String(scores[sub.id] ?? 3)}</SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="3">3</SelectItem>
                  <SelectItem value="4">4</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      ))}
      <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Assessment notes" />
      <Button
        type="button"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          await createCqcAssessment({
            propertyId,
            assessmentDate: new Date(),
            notes,
            scores: scoreRows,
          });
          setPending(false);
          router.push(`/audits/property/${propertyId}`);
          router.refresh();
        }}
      >
        {pending ? "Saving..." : "Save assessment"}
      </Button>
    </div>
  );
}
