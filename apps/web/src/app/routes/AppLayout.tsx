import { NavLink, Outlet, useNavigate } from "react-router-dom";

import { useAuthStore } from "../auth/store";

const NAV = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/leads", label: "Leads", end: false },
  { to: "/contacts", label: "Contacts", end: false },
  { to: "/team", label: "Team", end: false },
];

/**
 * Chrome shared by every authenticated page: brand, primary nav, and the
 * signed-in user. Rendered inside ProtectedRoute, so it only ever appears with
 * a live session.
 */
export default function AppLayout() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const onSignOut = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-900/10 bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-lg px-lg py-md">
          <span className="text-lg font-bold text-brand-600">go-CRM</span>

          <nav className="flex items-center gap-xs">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `rounded-md px-md py-xs text-sm font-medium transition ${
                    isActive
                      ? "bg-brand-50 text-brand-700"
                      : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-md">
            {user && (
              <span className="hidden text-sm text-neutral-500 sm:inline">
                {user.name?.trim() || user.email}
              </span>
            )}
            <button
              onClick={onSignOut}
              className="rounded-md border border-neutral-900/15 px-md py-xs text-sm font-medium text-neutral-900 transition hover:bg-neutral-50"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-lg py-xl">
        <Outlet />
      </main>
    </div>
  );
}
