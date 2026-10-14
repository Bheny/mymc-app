// The parts of Recognition the page and the server both need — no database imports, so it is safe
// to use from client components. The computation itself is in recognition.ts.

export const METRICS = ["souls", "firstTimers", "converted", "encounters", "attendance"] as const;
export type Metric = (typeof METRICS)[number];
export type Counts = Record<Metric, number>;

export const METRIC_LABELS: Record<Metric, { title: string; unit: string; blurb: string }> = {
  souls:       { title: "Souls won",    unit: "souls",        blurb: "Souls recorded as won by this member" },
  firstTimers: { title: "First timers", unit: "first timers", blurb: "First timers this member brought to a service" },
  converted:   { title: "Became members", unit: "converts",   blurb: "People this member brought who then became members" },
  encounters:  { title: "People reached", unit: "people met", blurb: "People met in outreach and personal evangelism" },
  attendance:  { title: "Faithfulness", unit: "services",     blurb: "Cell services attended" },
};

export type Subject = "members" | "cell" | "buscentre" | "mc";
export type Mode = "raw" | "perCapita";

// A group needs this many active members before it can be ranked per capita — one new cell
// with two people and a soul each would otherwise beat everyone
export const MIN_GROUP_SIZE = 5;

// The roles a member can hold, for the filter on the members board
export const ROLE_FILTERS: { value: string; label: string }[] = [
  { value: "none",           label: "Members (no role)" },
  { value: "shepherd",       label: "Shepherds" },
  { value: "cell_shepherd",  label: "Cell shepherds" },
  { value: "buscentre_head", label: "Buscentre heads" },
  { value: "mc_pastor",      label: "MC pastors" },
  { value: "chief_shepherd", label: "Chief shepherds" },
  { value: "admin",          label: "Admins" },
];

export type RankedRow = {
  rank: number; id: string; name: string; place: string;
  count: number;            // the raw number
  headcount: number | null; // groups only
  value: number;            // what it is ranked by — count, or count per member
  isYours: boolean;
};

export type RecognitionResponse = {
  period: { key: string; label: string; kind: "month" | "quarter" | "year" };
  frozen: boolean; generatedAt: string | null;
  metric: { key: Metric; title: string; unit: string; blurb: string };
  subject: Subject; mode: Mode;
  minGroupSize: number; tooSmall: number;
  canRegenerate: boolean;
  rows: RankedRow[];
};
