// The "radar" rule. Client-safe: no server imports.
//
// A guest who isn't a member yet and has come to 3 or more services in a calendar month
// comes to the attention of their buscentre head, who has a conversation with them about
// whether they'd like to stay. The conversation clears them until they qualify again.
// (Anyone can also become a member straight away — nothing here gates that.)

export const RADAR_VISITS = 3;

const monthOf = (d: string) => d.slice(0, 7);
function previousMonth(m: string): string {
  const [y, mo] = m.split("-").map(Number);
  return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, "0")}`;
}

export type RadarStatus =
  | { state: "radar";   visits: number; month: string; reachedOn: string }   // needs a conversation now
  | { state: "nearly";  visits: number; month: string }                      // one more service to go
  | { state: "none";    visits: number };

/**
 * `serviceDates`: the date of each distinct service they attended as a guest (first visit and
 * returning visits alike). `conversationAt`: when the buscentre head last spoke to them, if ever.
 *
 * The current month and the one before it are looked at, so someone who reached 3 visits at the
 * end of last month still shows up in the first days of this one.
 */
export function radarStatus(serviceDates: string[], conversationAt: string | null, today: string): RadarStatus {
  const thisMonth = monthOf(today);
  const sorted = [...serviceDates].sort();
  const inMonth = (m: string) => sorted.filter((d) => monthOf(d) === m);

  for (const m of [thisMonth, previousMonth(thisMonth)]) {
    const ds = inMonth(m);
    if (ds.length >= RADAR_VISITS) {
      const reachedOn = ds[RADAR_VISITS - 1];                       // the day they hit 3
      const spokenSince = !!conversationAt && conversationAt.slice(0, 10) >= reachedOn;
      if (!spokenSince) return { state: "radar", visits: ds.length, month: m, reachedOn };
    }
  }
  const now = inMonth(thisMonth);
  if (now.length === RADAR_VISITS - 1) return { state: "nearly", visits: now.length, month: thisMonth };
  return { state: "none", visits: now.length };
}

export const CONVERSATION_LABEL: Record<string, string> = {
  WANTS_TO_JOIN: "Wants to join", STILL_DECIDING: "Still deciding", NOT_STAYING: "Not staying",
};
