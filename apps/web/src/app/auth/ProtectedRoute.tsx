import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useIsAuthenticated } from "./store";

/**
 * Route guard for the authenticated app. Renders child routes when a valid
 * session exists, otherwise redirects to the login page (remembering where the
 * user was headed).
 */
export function ProtectedRoute() {
  const authenticated = useIsAuthenticated();
  const location = useLocation();

  if (!authenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}
