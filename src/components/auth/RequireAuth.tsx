import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../state/AuthContext";
import { LogoMark } from "../ui/Bits";

/**
 * Route guard for the app shell.
 * Cloud mode only admits users with a Supabase Auth session. The bundled demo
 * is available when Supabase is not configured and never uses a cloud identity.
 */
export function RequireAuth() {
  const { status, walled } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return (
      <div className="grid h-dvh place-items-center bg-bg" role="status" aria-label="Loading">
        <LogoMark className="size-10 animate-shimmer" />
      </div>
    );
  }
  if (walled && status !== "authed") {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <Outlet />;
}
