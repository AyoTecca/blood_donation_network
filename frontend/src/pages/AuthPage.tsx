import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { apiFetch } from "../api";
import { useAuth } from "../context/AuthContext";

type NetworkStats = {
  donor_count: number;
  patient_count: number;
  lives_saved_count: number;
};

function formatStatValue(n: number): string {
  return n.toLocaleString();
}

function IconEnvelope() {
  return (
    <svg className="auth-input__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M4 6h16v12H4V6zm0 0l8 6 8-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconLock() {
  return (
    <svg className="auth-input__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" strokeLinecap="round" />
    </svg>
  );
}

function IconUser() {
  return (
    <svg className="auth-input__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M6 20v-1a6 6 0 0 1 12 0v1" strokeLinecap="round" />
    </svg>
  );
}

function LogoMark() {
  return (
    <div className="auth-logo" aria-hidden>
      <svg viewBox="0 0 64 64" className="auth-logo__svg">
        <defs>
          <linearGradient id="authLogoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#e53935" />
            <stop offset="100%" stopColor="#ff7043" />
          </linearGradient>
        </defs>
        <circle cx="32" cy="32" r="30" fill="url(#authLogoGrad)" />
        <g transform="rotate(180 32 32)">
          <path
            d="M32 22c-4 6-10 9-10 15a6 6 0 0 0 10 4.2A6 6 0 0 0 42 37c0-6-6-9-10-15z"
            fill="#fff"
          />
        </g>
      </svg>
    </div>
  );
}

export function AuthPage() {
  const { token, login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [networkStats, setNetworkStats] = useState<"pending" | NetworkStats | "error">("pending");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch<NetworkStats>("/api/public/network-stats");
        if (!cancelled) setNetworkStats(data);
      } catch {
        if (!cancelled) setNetworkStats("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (token) {
    return <Navigate to="/" replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (mode === "signup" && fullName.trim().length < 2) {
      setError("Please enter your full name.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signin") {
        await login(email, password);
        if (rememberMe) {
          /* token already in localStorage; optional future: longer session */
        }
      } else {
        await register(email, password);
      }
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-landing">
      <div className="auth-landing__drops" aria-hidden>
        {Array.from({ length: 12 }).map((_, i) => (
          <span key={i} className="auth-drop" />
        ))}
      </div>

      <div className="auth-landing__main">
        <header className="auth-landing__header">
          <LogoMark />
          <h1 className="auth-landing__title">Blood Donation Network</h1>
          <p className="auth-landing__tagline">Save lives by connecting donors and recipients</p>
        </header>

        <div className="auth-panel">
        <div className="auth-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "signin"}
            className={`auth-tab${mode === "signin" ? " auth-tab--active" : ""}`}
            onClick={() => {
              setMode("signin");
              setError(null);
            }}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "signup"}
            className={`auth-tab${mode === "signup" ? " auth-tab--active" : ""}`}
            onClick={() => {
              setMode("signup");
              setError(null);
            }}
          >
            Sign up
          </button>
        </div>

        <form className="auth-form auth-form--modern" onSubmit={onSubmit}>
          {mode === "signup" && (
            <label className="auth-field">
              <span className="auth-field__label">
                Full name <span className="req">*</span>
              </span>
              <div className="auth-input-wrap">
                <IconUser />
                <input
                  type="text"
                  autoComplete="name"
                  className="auth-input"
                  placeholder="Jane Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required={mode === "signup"}
                  minLength={2}
                />
              </div>
            </label>
          )}

          <label className="auth-field">
            <span className="auth-field__label">
              Email <span className="req">*</span>
            </span>
            <div className="auth-input-wrap">
              <IconEnvelope />
              <input
                type="email"
                autoComplete="email"
                className="auth-input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </label>

          <label className="auth-field">
            <span className="auth-field__label">
              Password <span className="req">*</span>
            </span>
            <div className="auth-input-wrap">
              <IconLock />
              <input
                type="password"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                className="auth-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
          </label>

          {mode === "signin" && (
            <div className="auth-row-options">
              <label className="auth-check">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                Remember me
              </label>
              <button type="button" className="auth-link-btn" title="Not implemented in this demo">
                Forgot password?
              </button>
            </div>
          )}

          {error && <p className="auth-error">{error}</p>}

          <button type="submit" className="auth-submit" disabled={busy}>
            {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <p className="auth-footer-hint">
          {mode === "signin" ? (
            <>
              Don&apos;t have an account?{" "}
              <button type="button" className="auth-inline-link" onClick={() => setMode("signup")}>
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button type="button" className="auth-inline-link" onClick={() => setMode("signin")}>
                Sign in
              </button>
            </>
          )}
        </p>
        </div>

        <div className="auth-stats" aria-live="polite">
          <article className="auth-stat-card">
            <strong className="auth-stat-card__num">
              {networkStats === "pending"
                ? "…"
                : networkStats === "error"
                  ? "—"
                  : formatStatValue(networkStats.donor_count)}
            </strong>
            <span className="auth-stat-card__lbl">Donors</span>
          </article>
          <article className="auth-stat-card">
            <strong className="auth-stat-card__num">
              {networkStats === "pending"
                ? "…"
                : networkStats === "error"
                  ? "—"
                  : formatStatValue(networkStats.patient_count)}
            </strong>
            <span className="auth-stat-card__lbl">Recipients</span>
          </article>
          <article className="auth-stat-card">
            <strong className="auth-stat-card__num">
              {networkStats === "pending"
                ? "…"
                : networkStats === "error"
                  ? "—"
                  : formatStatValue(networkStats.lives_saved_count)}
            </strong>
            <span className="auth-stat-card__lbl">Lives saved</span>
          </article>
        </div>
      </div>
    </div>
  );
}
