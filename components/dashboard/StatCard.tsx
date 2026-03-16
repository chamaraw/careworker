import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  className,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  return (
    <Card className={cn("min-h-[52px]", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <span className="text-base font-medium text-[var(--muted-foreground)]">{title}</span>
        {Icon && <Icon className="size-5 text-[var(--muted-foreground)]" aria-hidden />}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">{value}</div>
        {subtitle && (
          <p className="body-text-muted text-sm mt-1">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}
