import { Metadata } from 'next'
import { LoginForm } from '@/components/login-form'

export const metadata: Metadata = {
  title: 'Login | MyMC App',
  description: 'Log in to your MyMC account',
}

export default function LoginPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-6">Welcome to MyMC</h1>
        <LoginForm />
      </div>
    </div>
  )
}

