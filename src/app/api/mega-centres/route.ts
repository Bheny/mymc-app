import { NextResponse } from "next/server";

// MegaCentre is superseded by the Branch → MegaChurch → Buscentre hierarchy.
// Use /api/org/branches, /api/org/mega-churches, etc. instead.
export async function GET() {
  return NextResponse.json({ error: "Moved — use /api/org hierarchy routes" }, { status: 410 });
}
export async function POST() {
  return NextResponse.json({ error: "Moved — use /api/org hierarchy routes" }, { status: 410 });
}
