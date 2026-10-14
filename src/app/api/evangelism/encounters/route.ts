import { recordEncounter, type EncounterInput } from "@/lib/evangelism-encounter";
import { json, readBody, requireEvangelismUser } from "@/lib/evangelism-api";

// POST /api/evangelism/encounters
// Personal evangelism outside a planned outreach — a member invites someone at
// work, on the bus, etc. Filed under the caller's own cell/buscentre/MC.
export async function POST(request: Request) {
  const auth = await requireEvangelismUser();
  if ("error" in auth) return auth.error;

  const body = await readBody<EncounterInput>(request);
  if (!body) return json({ error: "Invalid JSON" }, 400);

  const result = await recordEncounter(auth.user.id, { ...body, outreachId: null });
  return json(result.body, result.status);
}
