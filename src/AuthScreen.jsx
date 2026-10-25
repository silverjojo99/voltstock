import { useState } from "react";
import { Box } from "lucide-react";
import { supabase } from "./supabase.js";
import LanguageSwitcher from "./LanguageSwitcher.jsx";

export default function AuthScreen({ configured, recoveryMode, onRecoveryComplete, language, onLanguageChange, t }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [resetMode, setResetMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);

    try {
      if (recoveryMode) {
        if (password.length < 8) throw new Error(t("auth.passwordLengthError"));
        if (password !== confirmation) throw new Error(t("auth.passwordMismatch"));
        const { error: updateError } = await supabase.auth.updateUser({ password });
        if (updateError) throw updateError;
        setMessage(t("auth.passwordUpdated"));
        onRecoveryComplete();
      } else if (resetMode) {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        });
        if (resetError) throw resetError;
        setMessage(t("auth.resetSent"));
        setResetMode(false);
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
      }
    } catch (submitError) {
      setError(submitError.message || t("auth.requestFailed"));
    } finally {
      setBusy(false);
    }
  };

  const heading = recoveryMode ? t("auth.choosePassword") : resetMode ? t("auth.resetPassword") : t("auth.welcomeBack");

  return (
    <main className="auth-page">
      <div className="auth-language"><LanguageSwitcher language={language} onChange={onLanguageChange} /></div>
      <section className="auth-card">
        <div className="auth-brand">
          <span className="brand__logo">
            <Box size={22} color="#fff" strokeWidth={1.8} />
          </span>
          <span className="brand__name">Voltstock</span>
        </div>
        <span className="eyebrow">{t("auth.sharedOperations")}</span>
        <h1>{configured ? heading : t("auth.connectProject")}</h1>
        <p className="auth-copy">
          {configured
            ? recoveryMode
              ? t("auth.setInvitedPassword")
              : resetMode
                ? t("auth.resetLinkSent")
                : t("auth.signInInvitation")
            : t("auth.setupProject")}
        </p>

        {!configured && (
          <div className="auth-help">
            {t("auth.setupHelp")} <code>.env.example</code> {t("auth.setupHelpEnd")} <code>.env.local</code>,{" "}
            {t("auth.setupHelpSuffix")}
          </div>
        )}

        {configured && (
          <form className="auth-form" onSubmit={submit}>
            {!recoveryMode && (
              <label className="field">
                <span className="field__label">{t("auth.email")}</span>
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@company.com"
                />
              </label>
            )}
            {!resetMode && (
              <label className="field">
                <span className="field__label">{recoveryMode ? t("auth.newPassword") : t("auth.password")}</span>
                <input
                  type="password"
                  autoComplete={recoveryMode ? "new-password" : "current-password"}
                  required
                  minLength={recoveryMode ? 8 : undefined}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={recoveryMode ? t("auth.passwordMin") : t("auth.enterPassword")}
                />
              </label>
            )}
            {recoveryMode && (
              <label className="field">
                <span className="field__label">{t("auth.confirmPassword")}</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  placeholder={t("auth.reenterPassword")}
                />
              </label>
            )}
            {error && <p className="form-message form-message--error" role="alert">{error}</p>}
            {message && <p className="form-message form-message--success" role="status">{message}</p>}
            <button className="btn btn--primary auth-submit" type="submit" disabled={busy}>
              {busy
                ? t("auth.wait")
                : recoveryMode
                  ? t("auth.setPassword")
                  : resetMode
                    ? t("auth.emailResetLink")
                    : t("auth.signIn")}
            </button>
            {!recoveryMode && (
              <button
                className="text-btn"
                type="button"
                onClick={() => {
                  setError("");
                  setMessage("");
                  setResetMode((value) => !value);
                }}
              >
                {resetMode ? t("auth.backToSignIn") : t("auth.resetAction")}
              </button>
            )}
          </form>
        )}
      </section>
    </main>
  );
}
