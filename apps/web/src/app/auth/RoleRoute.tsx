import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "./store";

export function RequireRole({
  allowedRoles,
  redirectTo = "/",
}: {
  allowedRoles: string[];
  redirectTo?: string;
}) {
  const user = useAuthStore((s) => s.user);
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const role = user.role || "sales";
  if (!allowedRoles.includes(role)) {
    const dest = role === "engineer" ? "/implementation" : redirectTo;
    return <Navigate to={dest} replace />;
  }

  return <Outlet />;
}
