import { LiveDateTimeDisplay } from "@/components/hours/LiveDateTimeDisplay";

export function AuditReportFilingHeader({
  templateName,
  propertyName,
  patientLine,
  recordedByName,
  mode,
  submittedAtLabel,
  statusLabel,
}: {
  templateName: string;
  propertyName: string;
  patientLine?: string | null;
  recordedByName: string;
  mode: "recording" | "submitted";
  /** Pre-formatted local date/time string for stored reports */
  submittedAtLabel?: string | null;
  statusLabel?: string | null;
}) {
  return (
    <div className="rounded-xl border border-[#005EB8]/30 bg-gradient-to-br from-[#005EB8] to-[#004a94] text-white p-4 shadow-md space-y-3">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-white/85">Report</p>
        <h2 className="text-lg sm:text-xl font-semibold leading-tight">{templateName}</h2>
      </div>
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-white/75 text-xs">Venue</dt>
          <dd className="font-medium">{propertyName}</dd>
        </div>
        {patientLine ? (
          <div>
            <dt className="text-white/75 text-xs">Patient / service user</dt>
            <dd className="font-medium">{patientLine}</dd>
          </div>
        ) : (
          <div>
            <dt className="text-white/75 text-xs">Patient / service user</dt>
            <dd className="font-medium text-white/80">Not linked to a person</dd>
          </div>
        )}
        <div>
          <dt className="text-white/75 text-xs">Recorded by</dt>
          <dd className="font-medium">{recordedByName}</dd>
        </div>
        {mode === "recording" ? (
          <div className="sm:col-span-2">
            <dt className="text-white/75 text-xs mb-1">Time (now)</dt>
            <dd className="text-white">
              <LiveDateTimeDisplay variant="onDarkCompact" />
            </dd>
          </div>
        ) : (
          <>
            {submittedAtLabel ? (
              <div className="sm:col-span-2">
                <dt className="text-white/75 text-xs">Submitted</dt>
                <dd className="font-medium">{submittedAtLabel}</dd>
              </div>
            ) : null}
            {statusLabel ? (
              <div>
                <dt className="text-white/75 text-xs">Status</dt>
                <dd className="font-medium">{statusLabel}</dd>
              </div>
            ) : null}
          </>
        )}
      </dl>
    </div>
  );
}
