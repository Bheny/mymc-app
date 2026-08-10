import { Metadata } from "next";
import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = {
  title: "Login | MyMC App",
  description: "Log in to your MyMC account",
};

export default function LoginPage() {
  return (
    <div
      className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden"
      style={{
        background:
          "linear-gradient(160deg, var(--brand-navy) 0%, var(--brand-navy-mid) 55%, var(--brand-navy) 100%)",
      }}
    >
      {/* Decorative background — purely visual, never intercepts clicks */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="login-blob login-blob-a" />
        <div className="login-blob login-blob-b" />
        <div className="login-blob login-blob-c" />
        <div className="login-grid" />
      </div>

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
          style={{ background: "#fff", boxShadow: "0 20px 45px -15px rgba(15,31,61,0.45)" }}
        >
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
