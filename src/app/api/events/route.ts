import { NextResponse } from 'next/server'

// This would typically come from a database
const events = [
  { id: 1, title: 'Sunday Service', date: '2023-06-18', time: '10:00 AM', location: 'Main Hall' },
  { id: 2, title: 'Bible Study', date: '2023-06-20', time: '7:00 PM', location: 'Room 101' },
]

export async function GET() {
  return NextResponse.json(events)
}

export async function POST(request: Request) {
  const newEvent = await request.json()
  // In a real application, you would validate the input and save to a database
  events.push({ id: events.length + 1, ...newEvent })
  return NextResponse.json({ message: 'Event added successfully' }, { status: 201 })
}

