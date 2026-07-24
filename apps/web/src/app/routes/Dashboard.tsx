import { useNavigate } from "react-router-dom";

import { useAuthStore } from "../auth/store";

export default function Dashboard() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const onSignOut = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <main className="p-lg">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-brand-600">Dashboard</h1>
        <div className="flex items-center gap-md">
          {user && <span className="text-sm text-neutral-500">{user.email}</span>}
          <button
            onClick={onSignOut}
            className="rounded-md border border-neutral-900/15 px-md py-xs text-sm font-medium text-neutral-900 transition hover:bg-neutral-50"
          >
            Sign out
          </button>
        </div>
      </div>
      <p className="mt-md text-neutral-500">CRM dashboard SPA island.</p>
    </main>
  );
}
