// A member's position in the church, as shown on the Members page. Client-safe: no server imports.
// A system role wins; otherwise someone who holds a shepherd slot is a Shepherd; everyone else is a Member.

export const POSITIONS = ["member", "shepherd", "cell_shepherd", "buscentre_head", "mc_pastor", "chief_shepherd", "admin"] as const;
export type Position = (typeof POSITIONS)[number];

export const POSITION_LABEL: Record<Position, string> = {
  member:         "Member",
  shepherd:       "Shepherd",
  cell_shepherd:  "Cell Shepherd",
  buscentre_head: "Bacenta Head",
  mc_pastor:      "MC Pastor",
  chief_shepherd: "Chief Shepherd",
  admin:          "Admin",
};

export const isPosition = (v: unknown): v is Position => typeof v === "string" && (POSITIONS as readonly string[]).includes(v);

export function positionOf(m: { user?: { role?: { role?: string | null } | null } | null; shepherdRole?: unknown }): Position {
  const sys = m.user?.role?.role;
  if (isPosition(sys) && sys !== "member" && sys !== "shepherd") return sys;
  return m.shepherdRole ? "shepherd" : "member";
}
