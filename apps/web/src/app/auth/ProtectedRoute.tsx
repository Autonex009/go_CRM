import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useIsAuthenticated, useSessionUnknown } from "./store";

/**
 * Route guard for the authenticated app.
 *
 * The `unknown` state matters: on a cold load the boot refresh hasn't answered
 * yet, and redirecting then would bounce every returning user through /login for
 * a moment before landing them back. So: wait, then decide.
 */
export function ProtectedRoute() {
  const authenticated = useIsAuthenticated();
  const unknown = useSessionUnknown();
  const location = useLocation();

  if (unknown) {
    return <SessionSplash />;
  }
  if (!authenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}

/**
 * Shown for the one round-trip the boot refresh takes. Deliberately minimal — a
 * spinner that appears for 100ms reads as a flicker, so this is just the mark on
 * the page background.
 */
function SessionSplash() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas">
      <span className="flex h-[32px] w-[32px] animate-pulse items-center justify-center rounded-md bg-accent text-sm font-bold text-white">
        g
      </span>
    </div>
  );
}
