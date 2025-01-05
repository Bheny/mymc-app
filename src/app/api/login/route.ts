import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { email, password } = await request.json()

  // In a real application, you would validate the credentials against a database
  // and use proper authentication mechanisms (e.g., JWT, sessions)
  if (email === 'admin@example.com' && password === 'password') {
    // For demonstration purposes, we're just setting a cookie
    // In a real app, you'd set a proper session or token
    const response = NextResponse.json({ success: true })
    response.cookies.set('authenticated', 'true', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7, // 1 week
    })
    return response
  }

  return NextResponse.json({ success: false }, { status: 401 })
}

