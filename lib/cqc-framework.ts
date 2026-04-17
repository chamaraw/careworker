export type CqcSubArea = {
  id: string;
  title: string;
  regulations: string;
};

export type CqcSection = {
  keyQuestion: "SAFE" | "EFFECTIVE" | "CARING" | "RESPONSIVE" | "WELL_LED";
  title: string;
  subAreas: CqcSubArea[];
};

export const CQC_RATING_THRESHOLDS = {
  OUTSTANDING_MIN: 88,
  GOOD_MIN: 63,
  REQUIRES_IMPROVEMENT_MIN: 39,
  INADEQUATE_MIN: 0,
} as const;

export const RISK_CATEGORIES = [
  "Compliance",
  "Strategic",
  "Operational",
  "Clinical",
  "Environmental",
  "Financial",
  "Reputational",
] as const;

export const CQC_FRAMEWORK: CqcSection[] = [
  {
    keyQuestion: "SAFE",
    title: "People are protected from abuse and avoidable harm",
    subAreas: [
      { id: "safe_learning_culture", title: "Learning culture", regulations: "Regulations 12, 16, 17, 20" },
      { id: "safe_systems", title: "Safe systems, pathways and transitions", regulations: "Regulations 12, 17, (9)" },
      { id: "safe_safeguarding", title: "Safeguarding", regulations: "Regulations 11, 12, 13, 9, (17, 20)" },
      { id: "safe_manage_risk", title: "Involving people to manage risk", regulations: "Regulations 9, 11, 12, (10)" },
      { id: "safe_staffing", title: "Safe and effective staffing", regulations: "Regulations 12, 18, 19" },
      { id: "safe_environment", title: "Safe environments", regulations: "Regulations 12, 15, 17" },
      { id: "safe_ipc", title: "Infection prevention and control", regulations: "Regulations 12, 15, (17)" },
      { id: "safe_medicines", title: "Medicines optimisation", regulations: "Regulations 9, 12, (11)" },
    ],
  },
  {
    keyQuestion: "EFFECTIVE",
    title: "People’s care and support achieve good outcomes",
    subAreas: [
      { id: "effective_assessing_needs", title: "Assessing needs", regulations: "Regulations 9, 12, (10, 11, 17)" },
      { id: "effective_evidence_based", title: "Delivering evidence-based care and treatment", regulations: "Regulations 9, 10, 12, 14, 17, (11)" },
      { id: "effective_teamwork", title: "How staff, teams, and services work together", regulations: "Regulations 9, 12, (17)" },
      { id: "effective_healthier_lives", title: "Supporting people to live healthier lives", regulations: "Regulations 9, 12, (9A, 10, 11)" },
      { id: "effective_outcomes", title: "Monitoring and improving outcomes", regulations: "Regulations 12, 17, (9)" },
      { id: "effective_consent", title: "Consent to care and treatment", regulations: "Regulation 11" },
    ],
  },
  {
    keyQuestion: "CARING",
    title: "The service involves and treats people with compassion",
    subAreas: [
      { id: "caring_kindness", title: "Kindness, compassion and dignity", regulations: "Regulations 9, 10 (12)" },
      { id: "caring_individuals", title: "Treating people as individuals", regulations: "Regulations 9, 10, 14, 15" },
      { id: "caring_choice", title: "Independence, choice and control", regulations: "Regulations 9, 12, (9A and 10)" },
      { id: "caring_immediate_needs", title: "Responding to people’s immediate needs", regulations: "Regulations 9, 10, 11, 12, (16)" },
      { id: "caring_workforce", title: "Workforce wellbeing and enablement", regulations: "Regulations 9, 12, 17, 18" },
    ],
  },
  {
    keyQuestion: "RESPONSIVE",
    title: "The service meets people’s needs",
    subAreas: [
      { id: "responsive_person_centred", title: "Person-centred care", regulations: "Regulations 9, (10, 11, 12, 14)" },
      { id: "responsive_continuity", title: "Care provision, integration, and continuity", regulations: "Regulations 9, 12, 17, (10)" },
      { id: "responsive_information", title: "Providing information", regulations: "Regulations 9, 13, 17" },
      { id: "responsive_involving", title: "Listening to and involving people", regulations: "Regulations 16, 17 (9, 10)" },
      { id: "responsive_access", title: "Equity in access", regulations: "Regulations 12, 13, 15, 17, (9, 10)" },
      { id: "responsive_outcomes", title: "Equity in experiences and outcomes", regulations: "Regulations 12, 13, 17, (9, 10)" },
      { id: "responsive_future", title: "Planning for the future", regulations: "Regulations 9, 10, (11)" },
    ],
  },
  {
    keyQuestion: "WELL_LED",
    title: "Leadership, management and governance assure quality care",
    subAreas: [
      { id: "well_led_direction", title: "Shared direction and culture", regulations: "Regulations 10, 12, 17, (9) Related: 12" },
      { id: "well_led_leaders", title: "Capable, compassionate and inclusive leaders", regulations: "Regulations 6, 7, 18, 19 (4, 5) Related: 4, 14" },
      { id: "well_led_speak_up", title: "Freedom to speak up", regulations: "Regulations 10, 12, 17 (9)" },
      { id: "well_led_edi", title: "Workforce equality, diversity and inclusion", regulations: "Regulations 17, 18" },
      { id: "well_led_governance", title: "Governance, management and sustainability", regulations: "Regulations 17, (12) Related: 14, 15, 16, 18, 20, 22A" },
      { id: "well_led_partnership", title: "Partnerships and communities", regulations: "Regulations 12, 17 (9)" },
      { id: "well_led_learning", title: "Learning, improvement and innovation", regulations: "Regulation 17 (16)" },
    ],
  },
];

const LIKELIHOOD_WEIGHT: Record<string, number> = {
  RARE: 1,
  UNLIKELY: 2,
  POSSIBLE: 3,
  LIKELY: 4,
  ALMOST_CERTAIN: 5,
};

const IMPACT_WEIGHT: Record<string, number> = {
  NEGLIGIBLE: 1,
  MINOR: 2,
  MODERATE: 3,
  MAJOR: 4,
  CATASTROPHIC: 5,
};

export function getRiskScore(
  likelihood: keyof typeof LIKELIHOOD_WEIGHT,
  impact: keyof typeof IMPACT_WEIGHT
) {
  return LIKELIHOOD_WEIGHT[likelihood] * IMPACT_WEIGHT[impact];
}

export function getRiskBand(score: number) {
  if (score >= 16) return "red";
  if (score >= 10) return "orange";
  if (score >= 5) return "yellow";
  return "green";
}

export function getCqcRatingFromPercent(percent: number) {
  if (percent >= CQC_RATING_THRESHOLDS.OUTSTANDING_MIN) return "OUTSTANDING";
  if (percent >= CQC_RATING_THRESHOLDS.GOOD_MIN) return "GOOD";
  if (percent >= CQC_RATING_THRESHOLDS.REQUIRES_IMPROVEMENT_MIN) return "REQUIRES_IMPROVEMENT";
  return "INADEQUATE";
}
