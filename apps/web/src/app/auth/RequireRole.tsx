import { Navigate, Outlet } from "react-router-dom";

import { useAuthStore } from "./store";

/**
 * Route guard for admin/manager-only pages (currently just Actions).
 *
 * This only hides the nav link and bounces a direct visit — the real gate is
 * the gateway's RequireRole middleware, which is what a curious `fetch` from
 * devtools actually hits. Nest this inside `<ProtectedRoute/>`, which already
 * handles the "session not known yet" boot state.
 */
export function RequireRole({ roles }: { roles: string[] }) {
  const role = useAuthStore((s) => s.user?.role);

  if (!role || !roles.includes(role)) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}
