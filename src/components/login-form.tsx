"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { Eye, EyeOff } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    const result = await signIn('credentials', {
      redirect: false,
      email,
      password,
    })

    if (result?.error) {
      setError('Invalid email or password.')
      setIsLoading(false)
      return
    }

    router.push('/')
    router.refresh()
  }

  return (
    <>
      <h1 className="text-[24px] font-semibold mb-1" style={{ color: "var(--brand-text)" }}>
        Welcome back
      </h1>
      <p className="text-[14px] mb-6" style={{ color: "var(--brand-muted)" }}>
        Log in to your MyMC account.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="email"
            className="text-[12px] font-medium uppercase tracking-[0.04em]"
            style={{ color: "var(--brand-muted)" }}
          >
            Email
          </label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            autoFocus
            className="h-10 text-[14px]"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="password"
            className="text-[12px] font-medium uppercase tracking-[0.04em]"
            style={{ color: "var(--brand-muted)" }}
          >
            Password
          </label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="h-10 text-[14px] pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-0 top-0 h-10 w-10 flex items-center justify-center"
              style={{ color: "var(--brand-muted)" }}
              aria-label={showPassword ? "Hide password" : "Show password"}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {error && (
          <p className="text-[13px]" style={{ color: "var(--brand-danger)" }}>
            {error}
          </p>
        )}

        <Button
          type="submit"
          disabled={isLoading}
          className="h-10 text-[14px] font-medium mt-1"
          style={{ background: "var(--brand-navy)", color: "#fff", borderRadius: 8 }}
        >
          {isLoading ? 'Logging in…' : 'Log in'}
        </Button>

        <p className="text-[13px] text-center mt-1" style={{ color: "var(--brand-muted)" }}>
          Forgot your password? Contact your admin.
        </p>
      </form>
    </>
  )
}
