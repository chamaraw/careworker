import type { StaffAssistantFieldGlossary } from "@/lib/staff-assistant-types";

export function mergeStaffAssistantFieldGlossaries(
  defaults: StaffAssistantFieldGlossary[] | undefined,
  page: StaffAssistantFieldGlossary[] | undefined
): StaffAssistantFieldGlossary[] | undefined {
  if (!defaults?.length && !page?.length) return undefined;
  const map = new Map<string, StaffAssistantFieldGlossary>();
  for (const f of defaults ?? []) map.set(f.id, f);
  for (const f of page ?? []) map.set(f.id, { ...map.get(f.id), ...f });
  return Array.from(map.values());
}

export type StaffAssistantFlowLink = { label: string; href: string };

export type StaffAssistantFlowDefinition = {
  id: string;
  title: string;
  summary: string;
  steps: string[];
  links: StaffAssistantFlowLink[];
  /** Optional default field glossaries when the page does not register its own */
  defaultFields?: StaffAssistantFieldGlossary[];
};

const staffListFlow: StaffAssistantFlowDefinition = {
  id: "staff_list",
  title: "Staff & care workers",
  summary: "Add and manage people who can log in, get paid, and be rostered.",
  steps: [
    "Use “Add care worker” to create an account (email + password they can change later).",
    "Each worker needs a clear display name and optional phone for contact.",
    "Open a worker’s edit page to set pay (rate card, overrides, fallback hourly rate) and competency profiles.",
    "Use Audits → Workforce compliance to record training and competency evidence.",
  ],
  links: [
    { label: "Staff list", href: "/staff" },
    { label: "Workforce compliance", href: "/audits/workforce" },
    { label: "Roster", href: "/roster" },
    { label: "Rate cards", href: "/rate-cards" },
    { label: "Holiday rates", href: "/rates" },
  ],
  defaultFields: [
    {
      id: "email",
      label: "Email",
      required: true,
      whatGoodLooksLike: "A unique work email they can access; used to sign in.",
    },
    {
      id: "password",
      label: "Password",
      required: true,
      whatGoodLooksLike: "At least 8 characters; do not share real passwords with the assistant.",
    },
    {
      id: "name",
      label: "Name",
      required: true,
      whatGoodLooksLike: "Full name as it should appear on rosters and records.",
    },
    {
      id: "phone",
      label: "Phone",
      whatGoodLooksLike: "UK mobile or landline; optional but useful for shift contact.",
    },
    {
      id: "qualifications",
      label: "Qualifications",
      insertable: true,
      whatGoodLooksLike: "Short list of relevant diplomas, registrations, or training (e.g. NVQ, medication).",
    },
  ],
};

const staffEditFlow: StaffAssistantFlowDefinition = {
  id: "staff_edit",
  title: "Edit care worker",
  summary: "Update profile, pay rules, active status, and competency profiles for one worker.",
  steps: [
    "Name and phone identify the person on rosters and in the app.",
    "Qualifications are a short professional summary — not a full clinical history.",
    "Rate card applies packaged pay rules; per–shift-type overrides sit on top.",
    "Fallback hourly rate is used when nothing else matches (legacy-style pay).",
    "Scroll to Competency & training to assign profiles; record completions under Workforce compliance.",
    "Deactivate “Active” only if they should not log in or be assigned (they remain in history).",
  ],
  links: [
    { label: "Staff list", href: "/staff" },
    { label: "Competency section", href: "#competency" },
    { label: "Workforce compliance", href: "/audits/workforce" },
    { label: "Payroll", href: "/payroll" },
    { label: "Rate cards", href: "/rate-cards" },
  ],
  defaultFields: [
    {
      id: "rateCard",
      label: "Rate card",
      whatGoodLooksLike: "Pick a named card when this worker should follow a standard pay pattern.",
    },
    {
      id: "hourlyRate",
      label: "Fallback hourly rate",
      whatGoodLooksLike: "A single £/hr figure used when no card or override applies.",
    },
    {
      id: "qualifications",
      label: "Qualifications",
      insertable: true,
      whatGoodLooksLike: "Concise, factual qualifications relevant to regulated tasks.",
    },
  ],
};

const rosterFlow: StaffAssistantFlowDefinition = {
  id: "roster",
  title: "Roster & shifts",
  summary: "Plan who works when, where, and with which service user.",
  steps: [
    "Pick start and end times that match the real visit or sleep shift.",
    "Link the correct property and service user so notes and pay stay consistent.",
    "Shift notes support handwriting on iPad — keep them factual and contemporaneous.",
    "After saving, workers see shifts on their home dashboard and roster.",
  ],
  links: [
    { label: "Roster", href: "/roster" },
    { label: "Staff", href: "/staff" },
    { label: "Service users", href: "/service-users" },
  ],
};

const serviceUsersFlow: StaffAssistantFlowDefinition = {
  id: "service_users",
  title: "Service users",
  summary: "Maintain people receiving care: placement, contacts, and high-level needs.",
  steps: [
    "Name and property anchor day-to-day care and rostering.",
    "Allergies and medical notes should stay proportionate — not full GP records.",
    "Emergency contacts should be reachable and aware they may be called.",
    "Care package links drive audit expectations — pick the closest match.",
  ],
  links: [
    { label: "Service users", href: "/service-users" },
    { label: "Housing / properties", href: "/housing" },
    { label: "Roster", href: "/roster" },
  ],
};

const incidentsFlow: StaffAssistantFlowDefinition = {
  id: "incidents",
  title: "Incidents",
  summary: "Record safeguarding and operational incidents with proportionate detail.",
  steps: [
    "Choose severity honestly — it drives escalation and reporting expectations.",
    "Describe what happened in plain chronological language (who, what, when, where).",
    "Actions taken and follow-up show the organisation’s response.",
    "Do not paste unnecessary clinical identifiers into the assistant.",
  ],
  links: [
    { label: "Incidents", href: "/incidents" },
    { label: "Notes", href: "/notes" },
    { label: "Staff", href: "/staff" },
  ],
};

const notesFlow: StaffAssistantFlowDefinition = {
  id: "notes",
  title: "Notes (care notes)",
  summary: "Timestamped entries linked to shifts — factual, respectful, and attributable.",
  steps: [
    "Pick the shift that best matches when care was delivered.",
    "Choose a category so managers can filter medication, meals, behaviour, etc.",
    "Write what you observed or did — avoid speculation or blame.",
    "If sharing with the assistant, remove names or identifiers the person did not consent to share.",
  ],
  links: [
    { label: "Notes", href: "/notes" },
    { label: "Roster", href: "/roster" },
  ],
};

const workforceFlow: StaffAssistantFlowDefinition = {
  id: "workforce_compliance",
  title: "Workforce compliance",
  summary: "Track training and competency requirements across the team.",
  steps: [
    "Open a worker from Staff to assign competency profiles.",
    "Use audits and workforce views to see what is due or overdue.",
    "Record evidence where the product expects it — do not duplicate sensitive documents in chat.",
  ],
  links: [
    { label: "Workforce compliance", href: "/audits/workforce" },
    { label: "Staff", href: "/staff" },
    { label: "Audits home", href: "/audits" },
  ],
};

const payrollRatesFlow: StaffAssistantFlowDefinition = {
  id: "payroll_rates",
  title: "Pay & rates",
  summary: "Payroll, slips, rate cards, and UK holiday multipliers.",
  steps: [
    "Rate cards group pay rules; individual staff can override per shift type on their edit page.",
    "Holiday rates use UK public holidays — check /rates for the calendar view.",
    "Payroll processes timesheets for admins — workers see summaries on My pay where enabled.",
  ],
  links: [
    { label: "Payroll", href: "/payroll" },
    { label: "Rate cards", href: "/rate-cards" },
    { label: "Holiday rates", href: "/rates" },
    { label: "Staff", href: "/staff" },
  ],
};

const defaultAdminFlow: StaffAssistantFlowDefinition = {
  id: "admin_general",
  title: "Admin dashboard",
  summary: "You are in the Filey Care admin area — use the sidebar for major modules.",
  steps: [
    "Staff: accounts, pay rules, and competency assignment.",
    "Roster: shifts and large shift notes for workers.",
    "Audits: templates, submissions, workforce compliance, and recording.",
    "Use this Help panel for plain-language guidance — it never saves forms for you.",
  ],
  links: [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Staff", href: "/staff" },
    { label: "Audits", href: "/audits" },
    { label: "Incidents", href: "/incidents" },
  ],
};

export function resolveStaffAssistantFlow(pathname: string): StaffAssistantFlowDefinition {
  const p = pathname.split("?")[0] ?? pathname;
  if (p.startsWith("/staff/") && p.endsWith("/edit")) return staffEditFlow;
  if (p === "/staff" || p.startsWith("/staff/")) return staffListFlow;
  if (p.startsWith("/audits/workforce")) return workforceFlow;
  if (p.startsWith("/audits")) return defaultAdminFlow;
  if (p.startsWith("/roster")) return rosterFlow;
  if (p.startsWith("/service-users")) return serviceUsersFlow;
  if (p.startsWith("/incidents")) return incidentsFlow;
  if (p.startsWith("/notes") || p.startsWith("/journal")) return notesFlow;
  if (p.startsWith("/payroll") || p.startsWith("/rates") || p.startsWith("/rate-cards") || p.startsWith("/my-pay"))
    return payrollRatesFlow;
  return defaultAdminFlow;
}

export const STAFF_ASSISTANT_QUICK_INTENTS = [
  { id: "add_staff", label: "Add staff", prompt: "How do I add a new care worker and what fields matter?" },
  { id: "pay_rates", label: "Pay / rates", prompt: "Explain rate card vs fallback hourly rate and shift overrides." },
  { id: "roster", label: "Roster change", prompt: "How do I create or edit a shift and what should go in notes?" },
  { id: "incident", label: "Incident", prompt: "What should I put in an incident report and how do severities work?" },
  { id: "audit", label: "Audits", prompt: "Where do I record workforce training and compliance?" },
] as const;
