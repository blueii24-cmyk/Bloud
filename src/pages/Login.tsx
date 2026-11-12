import { useId, useState, type FormEvent, type ReactNode } from "react";
import { Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { AlertCircle, Eye, EyeOff, Headphones, Loader2, MailCheck } from "lucide-react";
import { useAuth } from "../state/AuthContext";
import { Wordmark } from "../components/ui/Bits";
import { cn } from "../utils/cn";

type Mode = "login" | "signup";
type Problem = { message: string; field?: string } | null;

const COPY: Record<Mode, { title: string; cta: string; switchText: string; switchCta: string }> = {
  login: { title: "Log in to Bloud", cta: "Log In", switchText: "Don't have an account?", switchCta: "Sign up for Bloud" },
  signup: { title: "Sign up to start listening", cta: "Sign Up", switchText: "Already have an account?", switchCta: "Log in here" },
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Spotify-inspired login: centred dark card on a soft gradient, bold title, outlined
 * secondary action, labelled fields with a show/hide toggle, "Remember me" switch and a
 * full-width pill CTA — styled with Bloud's own tokens (mint accent, surface, line).
 */
export default function Login() {
  const auth = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const uid = useId();

  const mode: Mode = params.get("mode") === "signup" ? "signup" : "login";
  const isSignup = mode === "signup";
  const copy = COPY[mode];
  const from = (location.state as { from?: string } | null)?.from ?? "/";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem>(null);
  const [confirmEmail, setConfirmEmail] = useState<string | null>(null);

  // Already in (or no Supabase to log in to): nothing to do here.
  if (auth.status === "authed" || auth.status === "guest" || !auth.walled) {
    return <Navigate to={from} replace />;
  }

  function switchMode() {
    setProblem(null);
    setConfirmEmail(null);
    setParams(isSignup ? {} : { mode: "signup" }, { replace: true, state: location.state });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setProblem(null);

    if (isSignup && !name.trim()) return setProblem({ message: "Tell us what to call you.", field: "name" });
    if (!email.trim()) return setProblem({ message: "Please enter your email address.", field: "email" });
    if (isSignup && !EMAIL_RE.test(email.trim())) return setProblem({ message: "That email doesn't look right.", field: "email" });
    if (!password) return setProblem({ message: "Please enter your password.", field: "password" });
    if (isSignup && password.length < 8) {
      return setProblem({ message: "Use at least 8 characters for your password.", field: "password" });
    }

    setBusy(true);
    const res = isSignup ? await auth.signUp(name, email, password, remember) : await auth.signIn(email, password, remember);
    setBusy(false);

    if (res.error) {
      const lower = res.error.toLowerCase();
      return setProblem({ message: res.error, field: lower.includes("already exists") ? "email" : undefined });
    }
    if (res.needsConfirmation) return setConfirmEmail(email.trim());
    nav(from, { replace: true });
  }

  const fieldError = (f: string) => (problem?.field === f ? problem.message : null);
  const formError = problem && !problem.field ? problem.message : null;

  return (
    <div className="fixed inset-0 overflow-y-auto bg-gradient-to-b from-[#1c1c1c] via-[#0b0b0b] to-black">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[420px] w-[820px] max-w-[140vw] -translate-x-1/2 rounded-full bg-accent/[0.12] blur-[120px]"
      />

      <div className="relative flex min-h-full flex-col">
        <header className="px-6 pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-10 sm:pt-8">
          <Wordmark />
        </header>

        <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-8 sm:py-12">
          <div className="animate-page-in w-full max-w-[480px] rounded-2xl bg-surface px-6 py-10 shadow-[0_24px_80px_rgba(0,0,0,0.6)] ring-1 ring-white/[0.05] sm:px-14 sm:py-12">
            {confirmEmail ? (
              <div className="animate-pop-in text-center">
                <span className="mx-auto grid size-14 place-items-center rounded-full bg-accent/15 text-accent">
                  <MailCheck className="size-7" />
                </span>
                <h1 className="mt-5 text-[1.75rem] leading-9 font-bold tracking-tight">Check your inbox</h1>
                <p className="mt-3 text-sm leading-relaxed text-fg-2">
                  We sent a confirmation link to <span className="font-semibold text-fg">{confirmEmail}</span>. Open it, then come back to log in.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmEmail(null);
                    setParams({}, { replace: true, state: location.state });
                  }}
                  className="mt-7 flex h-12 w-full items-center justify-center rounded-full bg-accent text-base font-bold text-on-accent transition duration-150 hover:scale-[1.02] hover:bg-accent-hover active:scale-[0.98]"
                >
                  Back to log in
                </button>
              </div>
            ) : (
              <>
                <h1 className="text-center text-[2rem] leading-10 font-bold tracking-tight text-balance">{copy.title}</h1>

                <div className="mt-8">
                  <button
                    type="button"
                    onClick={() => {
                      auth.continueAsGuest();
                      nav(from, { replace: true });
                    }}
                    disabled={busy}
                    className="flex h-12 w-full items-center justify-center gap-3 rounded-full border border-fg-3 text-sm font-bold text-fg transition duration-150 hover:border-fg hover:bg-white/[0.04] active:scale-[0.98] disabled:opacity-50"
                  >
                    <Headphones className="size-5" />
                    Continue as guest
                  </button>
                  <p className="mt-2 text-center text-xs text-fg-3">Demo mode — jump in without an account.</p>
                </div>

                <div role="separator" className="my-7 flex items-center gap-4 text-xs font-medium tracking-wider text-fg-3 uppercase">
                  <span className="h-px flex-1 bg-line" />
                  or
                  <span className="h-px flex-1 bg-line" />
                </div>

                <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5" aria-busy={busy}>
                  {formError && (
                    <div role="alert" className="animate-pop-in flex items-start gap-2.5 rounded-lg bg-danger/10 px-3.5 py-3 text-sm text-danger">
                      <AlertCircle className="mt-0.5 size-4 shrink-0" />
                      <span>{formError}</span>
                    </div>
                  )}

                  {isSignup && (
                    <Field id={`${uid}-name`} label="What should we call you?" error={fieldError("name")}>
                      <input
                        id={`${uid}-name`}
                        type="text"
                        autoComplete="name"
                        placeholder="Your name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        aria-invalid={!!fieldError("name")}
                        aria-describedby={fieldError("name") ? `${uid}-name-err` : undefined}
                        className={inputClass(!!fieldError("name"))}
                      />
                    </Field>
                  )}

                  <Field id={`${uid}-email`} label="Email address" error={fieldError("email")}>
                    <input
                      id={`${uid}-email`}
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      autoCapitalize="none"
                      spellCheck={false}
                      placeholder="name@domain.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      aria-invalid={!!fieldError("email")}
                      aria-describedby={fieldError("email") ? `${uid}-email-err` : undefined}
                      className={inputClass(!!fieldError("email"))}
                    />
                  </Field>

                  <Field id={`${uid}-password`} label="Password" error={fieldError("password")}>
                    <div className="relative">
                      <input
                        id={`${uid}-password`}
                        type={showPw ? "text" : "password"}
                        autoComplete={isSignup ? "new-password" : "current-password"}
                        placeholder={isSignup ? "At least 8 characters" : "Password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        aria-invalid={!!fieldError("password")}
                        aria-describedby={fieldError("password") ? `${uid}-password-err` : undefined}
                        className={cn(inputClass(!!fieldError("password")), "pr-12")}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw((v) => !v)}
                        aria-label={showPw ? "Hide password" : "Show password"}
                        aria-pressed={showPw}
                        className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-fg-2 transition-colors hover:text-fg"
                      >
                        {showPw ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                      </button>
                    </div>
                  </Field>

                  <label className="flex cursor-pointer items-center gap-3 select-none">
                    <span className="relative inline-flex h-5 w-9 shrink-0 items-center">
                      <input
                        type="checkbox"
                        role="switch"
                        checked={remember}
                        onChange={(e) => setRemember(e.target.checked)}
                        className="peer absolute inset-0 z-10 h-full w-full cursor-pointer appearance-none rounded-full"
                      />
                      <span className="absolute inset-0 rounded-full bg-fg-3 transition-colors peer-checked:bg-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent" />
                      <span className="absolute left-0.5 size-4 rounded-full bg-black transition-transform duration-200 peer-checked:translate-x-4" />
                    </span>
                    <span className="text-sm font-medium">Remember me</span>
                  </label>

                  <button
                    type="submit"
                    disabled={busy}
                    className="mt-1 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-accent text-base font-bold text-on-accent transition duration-150 hover:scale-[1.02] hover:bg-accent-hover active:scale-[0.98] disabled:opacity-60 disabled:hover:scale-100"
                  >
                    {busy && <Loader2 className="size-5 animate-spin" />}
                    {copy.cta}
                  </button>
                </form>

                <div className="mt-8 border-t border-line pt-7 text-center text-sm text-fg-2">
                  {copy.switchText}{" "}
                  <button type="button" onClick={switchMode} className="font-semibold text-fg underline underline-offset-2 hover:text-accent">
                    {copy.switchCta}
                  </button>
                  .
                </div>
              </>
            )}
          </div>

          <p className="flex items-center gap-3 text-xs text-fg-3">
            <span aria-hidden className="flex h-3.5 items-end gap-[3px]">
              {[0, 0.25, 0.1, 0.4].map((d) => (
                <span
                  key={d}
                  className="h-full w-[3px] origin-bottom rounded-full bg-accent"
                  style={{ animation: "eq 1.1s ease-in-out infinite", animationDelay: `${d}s` }}
                />
              ))}
            </span>
            Private music for two
          </p>
        </main>
      </div>
    </div>
  );
}

function inputClass(invalid: boolean) {
  return cn(
    "h-12 w-full rounded-md border bg-surface px-3.5 text-base text-fg placeholder:text-fg-3 transition-colors",
    "hover:border-fg focus:border-fg focus:outline-2 focus:outline-offset-0 focus:outline-fg",
    invalid ? "border-danger hover:border-danger focus:border-danger focus:outline-danger" : "border-fg-3",
  );
}

function Field({ id, label, error, children }: { id: string; label: string; error: string | null; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-bold">
        {label}
      </label>
      {children}
      {error && (
        <p id={`${id}-err`} role="alert" className="animate-fade-in flex items-center gap-1.5 text-[13px] text-danger">
          <AlertCircle className="size-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
