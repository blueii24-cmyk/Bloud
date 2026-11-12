import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import "./Login.css";
import { useAuth } from "../state/AuthContext";

type Problem = { message: string; field?: "email" | "password" } | null;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const OAUTH_RETURN_KEY = "bloud.auth-return";

function safeReturnPath(path: string | null | undefined): string {
  return path?.startsWith("/") && !path.startsWith("//") ? path : "/";
}

function storeOauthReturn(path: string) {
  try {
    sessionStorage.setItem(OAUTH_RETURN_KEY, path);
  } catch {
    /* OAuth still works; only the original route may be lost. */
  }
}

function clearOauthReturn() {
  try {
    sessionStorage.removeItem(OAUTH_RETURN_KEY);
  } catch {
    /* session storage may be unavailable */
  }
}

/** React implementation of the minimal login preview, wired to Bloud's real auth flow. */
export default function Login() {
  const auth = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const isSignup = params.get("mode") === "signup";
  const [oauthReturn, setOauthReturn] = useState(() => {
    try {
      return sessionStorage.getItem(OAUTH_RETURN_KEY);
    } catch {
      return null;
    }
  });
  const stateReturn = (location.state as { from?: string } | null)?.from;
  const from = safeReturnPath(stateReturn || oauthReturn);
  const id = useId();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem>(null);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<number | null>(null);
  const bars = useMemo(
    () =>
      Array.from({ length: Math.min(60, Math.ceil(window.innerWidth / 16)) }, () => ({
        delay: -Math.random() * 1.6,
        duration: 1.1 + Math.random() * 1.1,
      })),
    [],
  );

  useEffect(
    () => () => {
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (auth.status !== "authed") return;
    clearOauthReturn();
    setOauthReturn(null);
  }, [auth.status]);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const oauthError = query.get("error_description") || query.get("error");
    if (!oauthError) return;
    const lower = oauthError.toLowerCase();
    const message = lower.includes("provider is not enabled") || lower.includes("unsupported provider")
      ? "Google sign-in isn't enabled in Bloud yet. The administrator needs to configure Google under Supabase Auth."
      : oauthError.replace(/\+/g, " ");
    setProblem({ message });
  }, []);

  function showToast(message: string) {
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = window.setTimeout(() => setToast(""), 2200);
  }

  // Already in (or no Supabase to log in to): nothing to do here.
  if (auth.status === "authed" || auth.status === "guest" || !auth.walled) {
    return <Navigate to={from} replace />;
  }

  function switchMode() {
    setProblem(null);
    setParams(isSignup ? {} : { mode: "signup" }, { replace: true, state: location.state });
  }

  async function onGoogleSignIn() {
    if (busy) return;
    setProblem(null);
    setBusy(true);
    try {
      storeOauthReturn(from);
      setOauthReturn(from);
      const redirectTo = `${window.location.origin}${window.location.pathname}${window.location.search}${window.location.hash || "#/login"}`;
      const result = await auth.signInWithGoogle(redirectTo);
      if (result.error) {
        clearOauthReturn();
        setOauthReturn(null);
        setProblem({ message: result.error });
      }
    } catch (error) {
      clearOauthReturn();
      setOauthReturn(null);
      setProblem({ message: error instanceof Error ? error.message : "Couldn't start Google sign-in. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setProblem(null);

    const normalizedEmail = email.trim();
    if (!normalizedEmail) return setProblem({ message: "Enter your email address.", field: "email" });
    if (!EMAIL_RE.test(normalizedEmail)) return setProblem({ message: "Enter a valid email address.", field: "email" });
    if (!password) return setProblem({ message: "Enter your password.", field: "password" });
    if (isSignup && password.length < 8) {
      return setProblem({ message: "Use at least 8 characters.", field: "password" });
    }

    setBusy(true);
    try {
      const displayName = normalizedEmail.split("@")[0] || "Listener";
      const result = isSignup
        ? await auth.signUp(displayName, normalizedEmail, password, true)
        : await auth.signIn(normalizedEmail, password, true);

      if (result.error) {
        const lower = result.error.toLowerCase();
        setProblem({
          message: result.error,
          field: lower.includes("already exists") ? "email" : undefined,
        });
        return;
      }
      if (result.needsConfirmation) {
        showToast("Check your email to finish creating your account");
        setParams({}, { replace: true, state: location.state });
        return;
      }
      nav(from, { replace: true });
    } catch (error) {
      setProblem({ message: error instanceof Error ? error.message : "Something went wrong. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  function continueAsGuest() {
    auth.continueAsGuest();
    nav(from, { replace: true });
  }

  return (
    <main className="login-screen">
      <div className="login-backdrop" aria-hidden="true">
        <div className="login-orb login-orb--mint" />
        <div className="login-orb login-orb--blue" />
        <div className="login-bars">
          {bars.map((bar, index) => (
            <i key={index} style={{ animationDelay: `${bar.delay}s`, animationDuration: `${bar.duration}s` }} />
          ))}
        </div>
        <svg className="login-rings" viewBox="0 0 1200 1200" focusable="false">
          <circle cx="600" cy="600" r="170" />
          <circle className="login-ring--mint" cx="600" cy="600" r="250" style={{ animationDelay: "-1.2s" }} />
          <circle cx="600" cy="600" r="330" style={{ animationDelay: "-2.4s" }} />
          <circle cx="600" cy="600" r="410" style={{ animationDelay: "-3.6s" }} />
          <circle cx="600" cy="600" r="490" style={{ animationDelay: "-4.8s" }} />
          <circle cx="600" cy="600" r="570" style={{ animationDelay: "-6s" }} />
        </svg>
      </div>

      <section className="login-wrap" aria-labelledby={`login-title-${id}`}>
        <header className="login-head">
          <svg className="login-mark" viewBox="0 0 32 32" aria-hidden="true">
            <circle cx="12.5" cy="16" r="7" fill="none" stroke="#fff" strokeWidth="2.6" />
            <circle cx="19.5" cy="16" r="7" fill="none" stroke="#4fe3a1" strokeWidth="2.6" />
          </svg>
          <h1 id={`login-title-${id}`}>{isSignup ? "Create your account" : "Welcome back"}</h1>
        </header>

        <button className="login-google" type="button" onClick={onGoogleSignIn} disabled={busy} aria-busy={busy}>
          {busy ? <Loader2 className="login-spinner" size={19} aria-hidden="true" /> : (
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
            </svg>
          )}
          {busy ? "Connecting to Google…" : "Continue with Google"}
        </button>

        <div className="login-separator" role="separator" aria-label="or">
          <span />
          <span className="login-sr-only">or</span>
          <span />
        </div>

        <form className="login-form" onSubmit={onSubmit} noValidate aria-busy={busy}>
          <label className="login-sr-only" htmlFor={`login-email-${id}`}>Email address</label>
          <input
            id={`login-email-${id}`}
            className="login-input"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={problem?.field === "email"}
            aria-describedby={problem?.field === "email" ? `login-error-${id}` : undefined}
          />

          <label className="login-sr-only" htmlFor={`login-password-${id}`}>Password</label>
          <div className="login-password-wrap">
            <input
              id={`login-password-${id}`}
              className="login-input"
              type={showPassword ? "text" : "password"}
              autoComplete={isSignup ? "new-password" : "current-password"}
              placeholder={isSignup ? "Password (8+ characters)" : "Password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={problem?.field === "password"}
              aria-describedby={problem?.field === "password" ? `login-error-${id}` : undefined}
            />
            <button
              className="login-eye"
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
            </button>
          </div>

          {problem && <p className="login-error" id={`login-error-${id}`} role="alert">{problem.message}</p>}

          <button className="login-submit" type="submit" disabled={busy}>
            {busy ? <><Loader2 className="login-spinner" size={17} aria-hidden="true" /> {isSignup ? "Creating account…" : "Logging in…"}</> : isSignup ? "Sign up" : "Log in"}
          </button>
        </form>

        <footer className="login-foot">
          <button className="login-link" type="button" onClick={continueAsGuest} disabled={busy}>Continue as guest</button>
          <p>
            <span>{isSignup ? "Have an account?" : "New here?"}</span>{" "}
            <button className="login-link login-switch" type="button" onClick={switchMode} disabled={busy}>
              {isSignup ? "Log in" : "Create an account"}
            </button>
          </p>
        </footer>
      </section>

      <div className={`login-toast${toast ? " login-toast--visible" : ""}`} role="status" aria-live="polite">
        {toast}
      </div>
    </main>
  );
}
