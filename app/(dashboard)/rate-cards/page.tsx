import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getRateCards } from "./actions";
import { RateCardsClient } from "./RateCardsClient";

export default async function RateCardsPage() {
  const session = await auth();
  if (!session?.user) return null;
  if ((session.user as { role?: string }).role !== "ADMIN")
    redirect("/dashboard");

  const rateCards = await getRateCards();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Rate cards</h1>
        <p className="body-text-muted mt-1">
          Define pay rules by shift type (standard, lone working, sleep night). Assign a rate card to each employee in Staff edit.
        </p>
      </div>
      <RateCardsClient rateCards={rateCards} />
    </div>
  );
}
