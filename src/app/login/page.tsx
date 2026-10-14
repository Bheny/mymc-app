import { Suspense } from "react";
import { Metadata } from "next";
import { LoginForm } from "@/components/login-form";
import { LoginBackdrop } from "@/components/login-backdrop";

export const metadata: Metadata = {
  title: "Login | MyMC App",
  description: "Log in to your MyMC account",
};

export default function LoginPage() {
  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden">
      <LoginBackdrop />

      <div className="relative z-10 w-full max-w-sm flex flex-col items-center">
        <span className="mb-6 text-[20px] font-semibold" style={{ color: "#fff" }}>
          MyMC
          <span
            className="ml-1.5 text-[11px] font-medium px-1.5 py-0.5 rounded align-middle"
            style={{ background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.85)" }}
          >
            beta
          </span>
        </span>

        <div
          className="w-full rounded-xl p-8"
          style={{
            // Slightly see-through so the scene glows around and behind it, in either theme
            background: "color-mix(in srgb, var(--surface) 90%, transparent)",
            backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
            border: "1px solid rgba(255,255,255,0.14)",
            boxShadow: "0 24px 60px -20px rgba(0,0,0,0.6)",
          }}
        >
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>

        <p className="mt-6 max-w-xs text-center text-[13px] leading-relaxed italic"
           style={{ color: "rgba(255,255,255,0.82)", textShadow: "0 1px 12px rgba(0,0,0,0.6)" }}>
          &ldquo;I am the good shepherd: the good shepherd giveth his life for the sheep.&rdquo;
          <span className="not-italic block mt-1 text-[11px] tracking-[0.06em] uppercase" style={{ color: "rgba(255,255,255,0.6)" }}>John 10:11</span>
        </p>
      </div>
    </div>
  );
}
