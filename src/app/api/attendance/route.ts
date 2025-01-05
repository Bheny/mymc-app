import { NextResponse } from 'next/server'

// This would typically come from a database
const attendance = [
  { id: 1, eventId: 1, memberId: 1, status: 'present' },
  { id: 2, eventId: 1, memberId: 2, status: 'absent' },
  { id: 3, eventId: 1, memberId: 3, status: 'present' },
]

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const eventId = searchParams.get('eventId')

  if (eventId) {
    const eventAttendance = attendance.filter(a => a.eventId === parseInt(eventId))
    return NextResponse.json(eventAttendance)
  }

  return NextResponse.json(attendance)
}

export async function POST(request: Request) {
  const newAttendance = await request.json()
  // In a real application, you would validate the input and save to a database
  attendance.push({ id: attendance.length + 1, ...newAttendance })
  return NextResponse.json({ message: 'Attendance recorded successfully' }, { status: 201 })
}

