import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getHolidayRateBoosts } from "./actions";
import { HolidayRatesClient } from "./HolidayRatesClient";
import { UkPublicHolidaysGuide } from "./UkPublicHolidaysGuide";

export default async function RatesPage() {
  const session = await auth();
  if (!session?.user) return null;
  if ((session.user as { role?: string }).role !== "ADMIN") redirect("/dashboard");

  const boosts = await getHolidayRateBoosts();

  return (
    <div className="space-y-6">
      <h1 className="page-title">Holiday rates</h1>
      <p className="body-text-muted mt-1">
        UK public holidays are listed below so it’s clear which calendar dates are eligible for{" "}
        <span className="font-medium">higher pay</span> once you set a multiplier. Add each date in
        “Holiday rate boosts” — e.g. <span className="font-medium">1.5</span> means 1.5× pay for
        that day (all employees, all shift types).
      </p>
      <UkPublicHolidaysGuide boosts={boosts.map((b) => ({ date: b.date, multiplier: b.multiplier }))} />
      <HolidayRatesClient initialBoosts={boosts} />
    </div>
  );
}

