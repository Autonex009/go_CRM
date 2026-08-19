import type { ReactNode } from "react";

interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

/** Centered card shell shared by login, register and invitation acceptance. */
export function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-muted p-md">
      {/* Soft brand wash behind the card — one gradient, no images to download. */}
      <div className="pointer-events-none fixed inset-0 bg-gradient-to-br from-brand-50 via-neutral-50 to-neutral-100" />

      <div className="relative w-full max-w-[400px] animate-scale-in rounded-xl border border-line bg-surface p-xl shadow-md">
        <header className="mb-lg">
          <span className="flex items-center gap-sm">
            <span className="flex h-[30px] w-[30px] items-center justify-center rounded-md bg-accent text-sm font-bold text-white">
              g
            </span>
            <span className="text-sm font-semibold tracking-[-0.01em] text-fg">go-CRM</span>
          </span>

          <h1 className="mt-lg text-lg font-semibold tracking-[-0.01em] text-fg">
            {title}
          </h1>
          {subtitle && <p className="mt-xs text-sm text-fg-muted">{subtitle}</p>}
        </header>
        {children}
      </div>
    </main>
  );
}
