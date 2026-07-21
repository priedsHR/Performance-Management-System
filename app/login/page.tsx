"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Loader2, Target, BarChart3, MessagesSquare } from "lucide-react";
import PriedsLogo from "@/components/PriedsLogo";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const res = await signIn("credentials", {
      email: form.get("email"),
      password: form.get("password"),
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("Incorrect email or password.");
    } else {
      window.location.href = "/dashboard";
    }
  }

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-white border-r border-slate-200 flex-col items-center justify-center px-16">
        <div className="text-center max-w-xs">
          <div className="mb-6 flex justify-center"><PriedsLogo size="lg" tagline /></div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Performance Management System</h2>
          <p className="text-slate-500 text-sm leading-relaxed">
            OKR, 360° appraisal, IDP and talent insights for PRIEDS — in one place.
          </p>
          <div className="mt-8 grid grid-cols-3 gap-3">
            {[
              { icon: Target, label: "Objectives", desc: "Structured" },
              { icon: BarChart3, label: "Key Results", desc: "Measurable" },
              { icon: MessagesSquare, label: "360 Feedback", desc: "Holistic" },
            ].map((item) => (
              <div key={item.label} className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <item.icon size={18} className="mx-auto mb-1.5 text-[#0b8ec4]" />
                <p className="text-xs font-bold text-slate-700">{item.label}</p>
                <p className="text-xs text-slate-400 mt-0.5">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex justify-center mb-8 lg:hidden">
            <PriedsLogo size="md" tagline />
          </div>

          <div className="mb-7">
            <h1 className="text-2xl font-bold text-slate-900">Welcome back</h1>
            <p className="text-slate-500 text-sm mt-1">Sign in to your account to continue</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Email
              </label>
              <input
                name="email"
                type="email"
                required
                placeholder="name@prieds.com"
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Password
              </label>
              <input
                name="password"
                type="password"
                required
                placeholder="••••••••"
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <span></span>
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#0b8ec4] text-white hover:bg-[#097eb9] font-bold py-2.5 rounded-xl text-sm
                shadow-sm
                hover:shadow-sm
                active:shadow-sm
                disabled:opacity-60
                transition-all duration-75 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Sign in...
                </>
              ) : (
                <>Sign in</>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
