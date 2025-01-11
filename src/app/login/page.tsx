import { Metadata } from 'next'
import { LoginForm } from '@/components/login-form'

export const metadata: Metadata = {
  title: 'Login | MyMC App',
  description: 'Log in to your MyMC account',
}

export default function LoginPage() {
  return (
<div className="p-4 relative flex items-center justify-center min-h-screen bg-gradient-to-b from-gray-800 via-gray-900 to-black">
  {/* Starry Background */}
  <div className="absolute inset-0 overflow-hidden">
    {/* Twinkling Stars */}
    <div className="twinkling-stars"></div>

    {/* Shooting Stars */}
    <div className="shooting-stars"></div>
  </div>

  {/* Login Content */}
  <div className="relative w-full max-w-md bg-white p-4 shadow-lg rounded-xl z-10">
    <h1 className="text-3xl font-bold text-center mb-6 text-gray-800">Welcome to MyMC</h1>
    <LoginForm />
  </div>
</div>

  )
}

