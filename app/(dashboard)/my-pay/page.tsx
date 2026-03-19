import { auth } from "@/lib/auth";
import { getMyRatesAndVenues, getMyPaySlipPeriods } from "../payroll/actions";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download, Building2, CreditCard } from "lucide-react";

const SHIFT_LABELS: Record<string, string> = {
  STANDARD: "Standard",
  LONE_WORKING: "Lone working",
  SLEEP_NIGHT: "Sleep night",
};

export default async function MyPayPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const [ratesAndVenues, periods] = await Promise.all([
    getMyRatesAndVenues(),
    getMyPaySlipPeriods(),
  ]);

  const { rateCardName, rateCardRules, fallbackHourlyRate, overrides, propertiesWorked } =
    ratesAndVenues;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="page-title">My Pay</h1>
        <p className="body-text-muted mt-1">
          Your rate package, properties you have worked at, and payslips.
        </p>
      </div>

      {/* Rate package */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="size-5" />
            Your rate package
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {rateCardName ? (
            <p className="font-medium text-[var(--foreground)]">{rateCardName}</p>
          ) : (
            <p className="text-[var(--muted-foreground)]">No rate card assigned.</p>
          )}
          {rateCardRules.length > 0 && (
            <div>
              <p className="text-sm font-medium text-[var(--muted-foreground)] mb-2">Rates by shift type</p>
              <ul className="border border-stone-200 rounded-lg divide-y divide-stone-200">
                {rateCardRules.map((r) => (
                  <li key={r.shiftType} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                    <span>{SHIFT_LABELS[r.shiftType] ?? r.shiftType}</span>
                    <span className="text-[var(--muted-foreground)]">
                      {r.rateType === "FIXED" && r.fixedAmount != null
                        ? `£${r.fixedAmount.toFixed(2)} (fixed)`
                        : r.hourlyRate != null
                          ? `£${r.hourlyRate.toFixed(2)}/hr`
                          : "—"}
                      {r.bonusHours > 0 && ` + ${r.bonusHours} bonus hrs`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {overrides.length > 0 && (
            <div>
              <p className="text-sm font-medium text-[var(--muted-foreground)] mb-2">Your overrides</p>
              <ul className="border border-stone-200 rounded-lg divide-y divide-stone-200">
                {overrides.map((o) => (
                  <li key={o.shiftType} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                    <span>{SHIFT_LABELS[o.shiftType] ?? o.shiftType}</span>
                    <span className="text-[var(--muted-foreground)]">
                      {o.rateType === "FIXED" && o.fixedAmount != null
                        ? `£${o.fixedAmount.toFixed(2)} (fixed)`
                        : o.hourlyRate != null
                          ? `£${o.hourlyRate.toFixed(2)}/hr`
                          : "—"}
                      {o.bonusHours > 0 && ` + ${o.bonusHours} bonus hrs`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!rateCardName && rateCardRules.length === 0 && fallbackHourlyRate != null && (
            <p className="text-sm text-[var(--muted-foreground)]">
              Fallback hourly rate: £{fallbackHourlyRate.toFixed(2)}/hr
            </p>
          )}
        </CardContent>
      </Card>

      {/* Properties worked */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="size-5" />
            Properties you have worked at
          </CardTitle>
        </CardHeader>
        <CardContent>
          {propertiesWorked.length > 0 ? (
            <ul className="space-y-2">
              {propertiesWorked.map((p) => (
                <li key={p.id} className="flex items-center gap-2">
                  <Building2 className="size-4 text-[var(--muted-foreground)]" />
                  {p.name}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[var(--muted-foreground)]">No approved hours yet.</p>
          )}
        </CardContent>
      </Card>

      {/* Payslips */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="size-5" />
            Payslips
          </CardTitle>
          <p className="text-sm text-[var(--muted-foreground)] font-normal">
            Download or print your payslip for each pay period (open in new tab to print to PDF).
          </p>
        </CardHeader>
        <CardContent>
          {periods.length > 0 ? (
            <ul className="space-y-2">
              {periods.map((p) => (
                <li key={p.weekStart} className="flex items-center justify-between gap-4 py-2 border-b border-stone-100 last:border-0">
                  <span className="font-medium">{p.weekLabel}</span>
                  <Link
                    href={`/my-pay/slip?weekStart=${encodeURIComponent(p.weekStart)}&weekEnd=${encodeURIComponent(p.weekEnd)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="outline" size="sm" className="gap-2">
                      <Download className="size-4" />
                      Download
                    </Button>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[var(--muted-foreground)]">No payslips yet. Approved hours will appear here.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
