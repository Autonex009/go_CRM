import type { ReactNode } from "react";

interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

/** Centered card shell shared by the login and register pages. */
export function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 p-md">
      <div className="w-full max-w-sm rounded-lg border border-neutral-900/10 bg-white p-xl shadow-sm">
        <header className="mb-lg text-center">
          <h1 className="text-xl font-bold text-brand-600">go-CRM</h1>
          <h2 className="mt-md text-lg font-semibold text-neutral-900">{title}</h2>
          {subtitle && <p className="mt-xs text-sm text-neutral-500">{subtitle}</p>}
        </header>
        {children}
      </div>
    </main>
  );
}

/** Inline error banner for form-level (server) errors. */
export function Alert({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-md border border-red-200 bg-red-50 px-md py-sm text-sm text-red-700"
    >
      {children}
    </p>
  );
}

/** Horizontal rule with centered label, e.g. "or continue with". */
export function Divider({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-md text-xs uppercase tracking-wide text-neutral-500">
      <span className="h-px flex-1 bg-neutral-900/10" />
      {children}
      <span className="h-px flex-1 bg-neutral-900/10" />
    </div>
  );
}
