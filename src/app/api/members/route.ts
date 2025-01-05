import { NextResponse } from 'next/server'

// This would typically come from a database
const members = [
  { id: 1, name: 'John Doe', email: 'john@example.com', cell: 'Cell A' },
  { id: 2, name: 'Jane Smith', email: 'jane@example.com', cell: 'Cell B' },
  { id: 3, name: 'Mike Johnson', email: 'mike@example.com', cell: 'Cell A' },
]

export async function GET() {
  return NextResponse.json(members)
}

export async function POST(request: Request) {
  const newMember = await request.json()
  // In a real application, you would validate the input and save to a database
  members.push({ id: members.length + 1, ...newMember })
  return NextResponse.json({ message: 'Member added successfully' }, { status: 201 })
}

