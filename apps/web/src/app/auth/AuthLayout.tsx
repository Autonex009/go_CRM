import type { ReactNode } from "react";
import { Sparkles, ShieldCheck, Zap, BarChart3 } from "lucide-react";

interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <main className="relative flex min-h-screen items-center justify-center bg-canvas p-4 sm:p-6 lg:p-8 overflow-hidden select-none">
      {/* Dynamic Background Glows */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-indigo-500/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-purple-500/15 blur-3xl" />

      <div className="relative flex w-full max-w-4xl overflow-hidden rounded-3xl border border-line bg-surface shadow-2xl">
        {/* Left Side: Brand & Feature Highlights (Visible on md+) */}
        <div className="hidden md:flex flex-1 flex-col justify-between bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 p-10 text-white relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/10 via-transparent to-black/30" />
          
          {/* Header Logo */}
          <div className="relative z-10 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/20 bg-white/10 backdrop-blur-md overflow-hidden shadow-inner">
              <img src="/autonex_ai_logo.jpeg" alt="Autonex AI" className="h-full w-full object-cover" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight">DealBridge CRM</h2>
              <p className="text-[11px] font-medium text-white/70 uppercase tracking-widest">Powered by Autonex AI</p>
            </div>
          </div>

          {/* Center Showcase */}
          <div className="relative z-10 my-auto space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur-md">
              <Sparkles className="h-3.5 w-3.5 text-amber-300" />
              <span>Next-Gen CRM Pipeline Engine</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight leading-tight">
              Manage deals, quotes & leads with precision.
            </h1>
            <p className="text-sm text-white/80 leading-relaxed max-w-md">
              Real-time pipeline analytics, automated tax invoice generation, and unified lead tracking built for modern sales teams.
            </p>

            {/* Feature Pills */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-2.5 backdrop-blur-xs text-xs">
                <ShieldCheck className="h-4 w-4 text-emerald-300 shrink-0" />
                <span className="font-medium text-white/90">Role & Audit Security</span>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-2.5 backdrop-blur-xs text-xs">
                <Zap className="h-4 w-4 text-amber-300 shrink-0" />
                <span className="font-medium text-white/90">NATS Task Engine</span>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-2.5 backdrop-blur-xs text-xs col-span-2">
                <BarChart3 className="h-4 w-4 text-indigo-300 shrink-0" />
                <span className="font-medium text-white/90">Real-time GST Invoicing & Quotes</span>
              </div>
            </div>
          </div>

          {/* Footer Note */}
          <div className="relative z-10 pt-4 text-[11px] text-white/60">
            © {new Date().getFullYear()} Autonex AI Inc. All rights reserved.
          </div>
        </div>

        {/* Right Side: Form Container */}
        <div className="flex-1 p-8 sm:p-10 flex flex-col justify-center bg-surface">
          <div className="mb-6 md:hidden flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl overflow-hidden border border-line">
              <img src="/autonex_ai_logo.jpeg" alt="Autonex AI" className="h-full w-full object-cover" />
            </div>
            <span className="text-base font-bold text-fg">DealBridge</span>
          </div>

          <div className="mb-6 space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-fg">{title}</h1>
            {subtitle && <p className="text-xs text-fg-muted">{subtitle}</p>}
          </div>

          {children}
        </div>
      </div>
    </main>
  );
}

