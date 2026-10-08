// Client-safe structure-limit definitions (no Prisma import). Server code
// should use src/lib/capacity.ts, which layers the Settings overrides on top.

export const CAPACITY = {
  // MegaChurch: no cap — unlimited MCs per Branch
  buscentre: { parentField: "mcId",        max: 2, label: "Buscentres per MC" },
  cell:      { parentField: "buscentreId", max: 2, label: "Cells per Buscentre" },
  shepherd:  { parentField: "cellId",      max: 2, label: "Shepherds per Cell" },
  member:    { parentField: "shepherdId",  max: 5, label: "Members per Shepherd" },
} as const;

export type CapacityLevel = keyof typeof CAPACITY;
export const CAPACITY_LEVELS = Object.keys(CAPACITY) as CapacityLevel[];

export type CapacityLimit  = { max: number; enforce: boolean };
export type CapacityLimits = Record<CapacityLevel, CapacityLimit>;

export function isCapacityLevel(v: unknown): v is CapacityLevel {
  return typeof v === "string" && v in CAPACITY;
}

export function defaultCapacityLimits(): CapacityLimits {
  return Object.fromEntries(
    CAPACITY_LEVELS.map((l) => [l, { max: CAPACITY[l].max, enforce: false }])
  ) as CapacityLimits;
}
