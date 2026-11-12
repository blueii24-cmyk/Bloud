import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../state/AuthContext";
import { LogoMark } from "../ui/Bits";

/**
 * Route guard for the app shell.
 * Lets through: signed-in users, guests (demo mode) and everyone when Supabase isn't configured.
 * Everyone else is sent to /login and bounced back to where they were headed afterwards.
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
  if (walled && status === "anon") {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <Outlet />;
}
