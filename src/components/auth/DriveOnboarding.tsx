import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Cloud, LoaderCircle, ShieldCheck } from "lucide-react";
import { useAuth } from "../../state/AuthContext";
import { useGoogleDrive } from "../../state/GoogleDriveContext";
import { Button } from "../ui/Buttons";

function dismissedKey(userId: string) {
  return `bloud.drive-prompt.dismissed:${userId}`;
}

function rememberChoice(userId: string) {
  try {
    localStorage.setItem(dismissedKey(userId), "1");
  } catch {
    /* The prompt may return after a reload when storage is unavailable. */
  }
}

export function DriveOnboarding() {
  const auth = useAuth();
  const drive = useGoogleDrive();
  const navigate = useNavigate();
  const userId = auth.status === "authed" ? auth.user?.id : undefined;
  const [visible, setVisible] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId || drive.status === "loading" || drive.status === "connecting") {
      setVisible(false);
      return;
    }
    if (drive.status === "connected") {
      setVisible(false);
      return;
    }
    try {
      setVisible(localStorage.getItem(dismissedKey(userId)) !== "1");
    } catch {
      setVisible(true);
    }
  }, [userId, drive.status]);

  if (!visible || !userId) return null;

  const skip = () => {
    rememberChoice(userId);
    setLocalError(null);
    drive.clearError();
    setVisible(false);
  };

  const connect = async () => {
    setLocalError(null);
    const error = await drive.connect();
    if (error) {
      setLocalError(error);
      return;
    }
    rememberChoice(userId);
    setVisible(false);
    navigate("/drive");
  };

  const error = localError || drive.error;
  const waiting = drive.status === "connecting";
  const identityLoading = drive.configured && !drive.identityReady && !drive.error;
  const identityFailed = drive.configured && !drive.identityReady && Boolean(drive.error);

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" role="presentation">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="drive-onboarding-title"
        aria-describedby="drive-onboarding-description"
        className="w-full max-w-md rounded-2xl border border-line bg-bg-2 p-6 shadow-2xl sm:p-7"
      >
        <span className="grid size-12 place-items-center rounded-2xl bg-accent/10 text-accent">
          <Cloud className="size-6" />
        </span>
        <p className="t-eyebrow mt-5">Optional connection</p>
        <h2 id="drive-onboarding-title" className="mt-1 text-xl font-semibold">Connect your Google Drive?</h2>
        <p id="drive-onboarding-description" className="t-meta mt-2 text-sm leading-6">
          Browse a music folder and stream supported audio in Bloud. Drive access is separate from sign-in, read-only, and can be disconnected any time.
        </p>
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-white/[0.04] p-3 text-xs leading-5 text-fg-2">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent" />
          Bloud only requests Google Drive read access after you choose Connect. Your files aren't uploaded to Bloud.
        </p>
        {error && <p className="mt-3 text-sm text-danger" role="alert">{error}</p>}
        {!drive.configured && (
          <p className="mt-3 text-xs text-fg-3">Google Drive setup is not finished yet. You can skip this and connect later.</p>
        )}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={skip} disabled={waiting}>Not now</Button>
          <Button variant="primary" onClick={connect} disabled={waiting || identityLoading || identityFailed}>
            {waiting || identityLoading ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
            {waiting ? "Connecting…" : identityLoading ? "Loading Google…" : identityFailed ? "Google unavailable" : "Connect Google Drive"}
          </Button>
        </div>
      </section>
    </div>
  );
}
