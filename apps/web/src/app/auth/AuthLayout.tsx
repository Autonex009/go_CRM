import type { ReactNode } from "react";
import { Sparkles, ShieldCheck, Zap, BarChart3 } from "lucide-react";

export type AuthPortalVariant = "admin" | "manager" | "engineer";

interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  variant?: AuthPortalVariant;
  children: ReactNode;
}

const variantConfig: Record<
  AuthPortalVariant,
  {
    gradient: string;
    badge: string;
    heading: string;
    description: string;
    pills: { icon: typeof ShieldCheck; text: string; color: string }[];
  }
> = {
  admin: {
    gradient: "from-indigo-600 via-indigo-700 to-purple-800",
    badge: "Next-Gen CRM Pipeline Engine",
    heading: "Manage deals, quotes & leads with precision.",
    description:
      "Real-time pipeline analytics, automated tax invoice generation, and unified lead tracking built for modern sales teams.",
    pills: [
      { icon: ShieldCheck, text: "Role & Audit Security", color: "text-emerald-300" },
      { icon: Zap, text: "NATS Task Engine", color: "text-amber-300" },
      { icon: BarChart3, text: "Real-time GST Invoicing & Quotes", color: "text-indigo-300" },
    ],
  },
  manager: {
    gradient: "from-purple-700 via-indigo-800 to-blue-900",
    badge: "Engineering & Delivery Management",
    heading: "Plan, delegate & track your engineering team.",
    description:
      "Break down deal implementation into high-velocity asks, assign engineers, and monitor execution across your roster.",
    pills: [
      { icon: ShieldCheck, text: "Team Allocation Matrix", color: "text-purple-300" },
      { icon: Zap, text: "Sub-task Delegation", color: "text-amber-300" },
      { icon: BarChart3, text: "Progress Kanban & Velocity", color: "text-blue-300" },
    ],
  },
  engineer: {
    gradient: "from-emerald-700 via-teal-800 to-cyan-900",
    badge: "Engineer Focus Portal",
    heading: "Focus on what matters — your tasks, your progress.",
    description:
      "Distraction-free personal task queue, direct status updates, blocker flagging, and seamless delivery coordination.",
    pills: [
      { icon: ShieldCheck, text: "Dedicated 'My Tasks' Queue", color: "text-emerald-300" },
      { icon: Zap, text: "Instant Blocker Alerts", color: "text-amber-300" },
      { icon: BarChart3, text: "Shielded Distraction-Free UI", color: "text-teal-300" },
    ],
  },
};

export function AuthLayout({ title, subtitle, variant = "admin", children }: AuthLayoutProps) {
  const current = variantConfig[variant] || variantConfig.admin;

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-canvas p-4 sm:p-6 lg:p-8 overflow-hidden select-none">
      {/* Dynamic Background Glows */}
      <div className={`pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full blur-3xl transition-colors duration-500 ${
        variant === "engineer" ? "bg-emerald-500/15" : variant === "manager" ? "bg-purple-500/15" : "bg-indigo-500/15"
      }`} />
      <div className={`pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full blur-3xl transition-colors duration-500 ${
        variant === "engineer" ? "bg-teal-500/15" : variant === "manager" ? "bg-blue-500/15" : "bg-purple-500/15"
      }`} />

      <div className="relative flex w-full max-w-4xl overflow-hidden rounded-3xl border border-line bg-surface shadow-2xl">
        {/* Left Side: Brand & Feature Highlights (Visible on md+) */}
        <div className={`hidden md:flex flex-1 flex-col justify-between bg-gradient-to-br ${current.gradient} p-10 text-white relative overflow-hidden transition-all duration-500`}>
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
              <span>{current.badge}</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight leading-tight">
              {current.heading}
            </h1>
            <p className="text-sm text-white/80 leading-relaxed max-w-md">
              {current.description}
            </p>

            {/* Feature Pills */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              {current.pills.map((pill, i) => {
                const IconComp = pill.icon;
                return (
                  <div
                    key={i}
                    className={`flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-2.5 backdrop-blur-xs text-xs ${
                      i === 2 ? "col-span-2" : ""
                    }`}
                  >
                    <IconComp className={`h-4 w-4 ${pill.color} shrink-0`} />
                    <span className="font-medium text-white/90">{pill.text}</span>
                  </div>
                );
              })}
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

