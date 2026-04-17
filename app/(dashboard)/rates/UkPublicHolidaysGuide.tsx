import { format, startOfYear, endOfYear, addYears } from "date-fns";
import { CalendarRange, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getUkBankHolidaysInRange } from "@/lib/uk-bank-holidays";

type BoostRow = { date: Date; multiplier: number };

function dateKey(d: Date) {
  return format(d, "yyyy-MM-dd");
}

/**
 * Reference list of UK public holidays so admins know which calendar dates
 * typically need a multiplier configured for higher holiday pay.
 */
export function UkPublicHolidaysGuide({ boosts }: { boosts: BoostRow[] }) {
  const now = new Date();
  const rangeStart = startOfYear(now);
  const rangeEnd = endOfYear(addYears(now, 1));
  const ukHolidays = getUkBankHolidaysInRange(rangeStart, rangeEnd);

  const multiplierByDateKey = new Map<string, number>();
  for (const b of boosts) {
    multiplierByDateKey.set(dateKey(new Date(b.date)), b.multiplier);
  }

  const configuredCount = ukHolidays.filter((h) => multiplierByDateKey.has(h.dateKey)).length;

  return (
    <Card className="border-amber-200/80 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20">
      <CardHeader className="pb-2">
        <CardTitle className="section-title flex flex-wrap items-center gap-2">
          <CalendarRange className="size-5 text-amber-700 dark:text-amber-400" />
          UK public holidays (reference)
        </CardTitle>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          These are official{" "}
          <span className="font-medium text-[var(--foreground)]">public / bank holidays</span> across
          England, Scotland, Wales and Northern Ireland (merged calendar). When you add a matching
          date below with a multiplier <span className="font-medium">greater than 1</span>, payroll
          pays that rate for work on that day — so customers can see which dates are intended for{" "}
          <span className="font-medium text-amber-800 dark:text-amber-200">higher holiday pay</span>.
        </p>
        <p className="text-xs text-[var(--muted-foreground)] mt-2">
          Showing {ukHolidays.length} dates from {format(rangeStart, "MMM yyyy")} to{" "}
          {format(rangeEnd, "MMM yyyy")}.{" "}
          <span className="font-medium text-[var(--foreground)]">
            {configuredCount} of {ukHolidays.length}
          </span>{" "}
          currently have a multiplier set in Holiday rate boosts.
        </p>
      </CardHeader>
      <CardContent>
        {ukHolidays.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No holidays in this range.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-amber-200/60 dark:border-amber-900/40 bg-background/80">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Holiday</TableHead>
                  <TableHead className="text-right">Holiday pay</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ukHolidays.map((h) => {
                  const mult = multiplierByDateKey.get(h.dateKey);
                  const hasHigher = mult != null && mult > 1;
                  const hasAny = mult != null;
                  return (
                    <TableRow key={h.dateKey}>
                      <TableCell className="whitespace-nowrap font-medium tabular-nums">
                        {format(new Date(h.dateKey + "T12:00:00"), "EEE d MMM yyyy")}
                      </TableCell>
                      <TableCell>{h.name}</TableCell>
                      <TableCell className="text-right">
                        {hasHigher ? (
                          <Badge className="gap-1 bg-teal-700 hover:bg-teal-700">
                            <TrendingUp className="size-3.5" />
                            Higher rate: {mult.toFixed(2)}×
                          </Badge>
                        ) : hasAny ? (
                          <span className="text-sm text-muted-foreground">
                            Multiplier {mult.toFixed(2)}× (standard)
                          </span>
                        ) : (
                          <span className="text-sm text-amber-800 dark:text-amber-200">
                            Add below to set higher rate
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
