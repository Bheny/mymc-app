import { NextResponse } from 'next/server'
import { getServerSession } from "next-auth/next"

export async function POST(request: Request) {
  const session = await getServerSession()

  if (!session?.user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const data = await request.json()

  // In a real application, you would update the user's notification preferences in your database
  // For this example, we'll just return a success message
  console.log('Updating notification preferences:', data)

  return NextResponse.json({ message: 'Notification preferences updated successfully' })
}

