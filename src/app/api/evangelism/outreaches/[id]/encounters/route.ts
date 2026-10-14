import { recordEncounter, type EncounterInput } from "@/lib/evangelism-encounter";
import { json, readBody, requireEvangelismUser } from "@/lib/evangelism-api";

// POST /api/evangelism/outreaches/[id]/encounters
// Record someone met on this outreach — a new person ({ contact }) or someone
// we already know ({ contactId }). Returns 409 with a `code` for duplicates.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireEvangelismUser();
  if ("error" in auth) return auth.error;

  const body = await readBody<EncounterInput>(request);
  if (!body) return json({ error: "Invalid JSON" }, 400);

  const result = await recordEncounter(auth.user.id, { ...body, outreachId: params.id });
  return json(result.body, result.status);
}
