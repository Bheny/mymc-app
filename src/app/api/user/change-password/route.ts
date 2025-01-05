import { NextResponse } from 'next/server'
import { getServerSession } from "next-auth/next"

export async function POST(request: Request) {
  const session = await getServerSession()

  if (!session?.user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const data = await request.json()

  // In a real application, you would verify the current password and update the new password in your database
  // For this example, we'll just return a success message
  console.log('Changing password for user:',data, session.user.email)

  return NextResponse.json({ message: 'Password changed successfully' })
}

