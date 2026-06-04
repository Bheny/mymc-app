import { NextResponse } from "next/server";

// Attendance is not yet implemented in this version of the schema.
export async function GET() {
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}
export async function POST() {
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}
