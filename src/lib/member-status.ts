// Reasons a member can be marked inactive. Stored as the key on
// MemberStatusChange.reason; labels are for display. Client-safe.
export const MEMBER_INACTIVE_REASONS = {
  RELOCATED:        "Relocated / moved away",
  CHANGED_CHURCH:   "Joined another church",
  STOPPED_COMING:   "Stopped attending / unreachable",
  SCHOOL_OR_WORK:   "Away for school or work",
  HEALTH:           "Health reasons",
  DECEASED:         "Deceased",
  OTHER:            "Other",
} as const;

export type MemberInactiveReason = keyof typeof MEMBER_INACTIVE_REASONS;

export function isInactiveReason(v: unknown): v is MemberInactiveReason {
  return typeof v === "string" && v in MEMBER_INACTIVE_REASONS;
}

export function inactiveReasonLabel(v: string | null | undefined): string | null {
  return v && isInactiveReason(v) ? MEMBER_INACTIVE_REASONS[v] : v ?? null;
}

// Minimum length for the free-text details on deactivation
export const STATUS_DETAILS_MIN = 5;
