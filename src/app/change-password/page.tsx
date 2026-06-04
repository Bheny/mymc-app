"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    const form     = new FormData(e.currentTarget);
    const password = form.get("password") as string;
    const confirm  = form.get("confirm")  as string;

    if (password !== confirm) { setError("Passwords do not match."); return; }
    if (password.length < 8)  { setError("Password must be at least 8 characters."); return; }

    setLoading(true);
    const res = await fetch("/api/auth/change-password", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ password }),
    });

    if (res.ok) {
      router.push("/");
      router.refresh(); // re-fetch server session so mustChangePassword clears
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div
        className="w-full max-w-sm rounded-xl p-8"
        style={{ border: "1px solid var(--brand-border)" }}
      >
        <h1
          className="text-[24px] font-semibold mb-1"
          style={{ color: "var(--brand-text)" }}
        >
          Set your password
        </h1>
        <p className="text-[14px] mb-6" style={{ color: "var(--brand-muted)" }}>
          This is your first login. Please choose a new password to continue.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="password"
              className="text-[12px] font-medium uppercase tracking-[0.04em]"
              style={{ color: "var(--brand-muted)" }}
            >
              New password
            </label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="At least 8 characters"
              required
              minLength={8}
              className="h-10 text-[14px]"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="confirm"
              className="text-[12px] font-medium uppercase tracking-[0.04em]"
              style={{ color: "var(--brand-muted)" }}
            >
              Confirm password
            </label>
            <Input
              id="confirm"
              name="confirm"
              type="password"
              placeholder="Repeat your password"
              required
              minLength={8}
              className="h-10 text-[14px]"
            />
          </div>

          {error && (
            <p className="text-[13px]" style={{ color: "var(--brand-danger)" }}>
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="h-10 text-[14px] font-medium mt-1"
            style={{ background: "var(--brand-navy)", color: "#fff", borderRadius: 8 }}
          >
            {loading ? "Saving…" : "Set password"}
          </Button>
        </form>
      </div>
    </div>
  );
}
