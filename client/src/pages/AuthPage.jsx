import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { FiArrowRight, FiCheckCircle, FiEye, FiEyeOff, FiFileText } from "react-icons/fi";
import { api } from "../api.js";
import { Button } from "../components/ui/button.jsx";
import { Input } from "../components/ui/input.jsx";
import TermsAcceptanceDialog from "../components/TermsAcceptanceDialog.jsx";

export default function AuthPage({ onAuthenticated, initialMode = "login" }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState(initialMode);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [termsPage, setTermsPage] = useState(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsChecked, setTermsChecked] = useState(false);
  const [termsDialogOpen, setTermsDialogOpen] = useState(false);
  const [termsError, setTermsError] = useState("");
  const [termsLoading, setTermsLoading] = useState(false);

  useEffect(() => {
    setMode(initialMode);
    setError("");
    setShowPassword(false);
  }, [initialMode]);

  useEffect(() => {
    if (mode !== "register") {
      setTermsDialogOpen(false);
      return undefined;
    }

    let active = true;
    setTermsDialogOpen(true);
    setTermsLoading(true);
    setTermsError("");
    api.platformContent.public("terms").then(page => {
      if (!active) return;
      setTermsPage(page);
    }).catch(loadError => {
      if (!active) return;
      setTermsPage(null);
      setTermsError(loadError.message || "Unable to load the current Terms & Conditions.");
    }).finally(() => {
      if (active) setTermsLoading(false);
    });
    return () => { active = false; };
  }, [mode]);

  async function retryTerms() {
    setTermsLoading(true);
    setTermsError("");
    try {
      const page = await api.platformContent.public("terms");
      setTermsPage(page);
      setTermsDialogOpen(true);
    } catch (loadError) {
      setTermsError(loadError.message || "Unable to load the current Terms & Conditions.");
    } finally {
      setTermsLoading(false);
    }
  }

  function handleTermsDialogChange(open) {
    setTermsDialogOpen(open);
    if (!open && !termsAccepted) setTermsChecked(false);
  }

  function acceptTerms() {
    if (!termsChecked || !termsPage?.versionId || termsLoading) return;
    setTermsAccepted(true);
    setTermsDialogOpen(false);
  }

  async function submit(event) {
    event.preventDefault();
    if (submitting) return;
    setError("");

    if (mode === "register" && (!termsPage?.versionId || !termsAccepted)) {
      setTermsDialogOpen(true);
      setError("Review and accept the Terms & Conditions in the pop-up window to continue.");
      return;
    }

    setSubmitting(true);
    try {
      let data;
      if (mode === "register") {
        const currentTerms = await api.platformContent.public("terms");
        if (currentTerms.versionId !== termsPage.versionId) {
          setTermsPage(currentTerms);
          setTermsAccepted(false);
          setTermsChecked(false);
          setTermsDialogOpen(true);
          setError("The Terms & Conditions have been updated. Please review and accept the latest version.");
          return;
        }
        data = await api.register({
          ...form,
          termsVersionId: currentTerms.versionId,
          termsAccepted: true
        });
      } else {
        data = await api.login(form);
      }

      localStorage.setItem("booking_token", data.token);
      localStorage.setItem("booking_user", JSON.stringify(data.user));
      onAuthenticated(data.user);
      navigate(location.state?.from || "/dashboard", { replace: true });
    } catch (requestError) {
      setError(requestError.message || "Unable to complete this request. Please try again.");
      if (mode === "register" && /terms|accept/i.test(requestError.message || "")) {
        setTermsAccepted(false);
        setTermsChecked(false);
        setTermsDialogOpen(true);
        retryTerms();
      }
    } finally {
      setSubmitting(false);
    }
  }

  function changeMode(next) {
    if (submitting || next === mode) return;
    setMode(next);
    setError("");
    setShowPassword(false);
    setTermsAccepted(false);
    setTermsChecked(false);
    setTermsPage(null);
    setTermsError("");
    setTermsDialogOpen(next === "register");
    navigate(next === "register" ? "/register" : "/login", { replace: true, state: location.state });
  }

  const isRegister = mode === "register";

  return <main className="auth-shell">
    <section className="auth-card" aria-labelledby="auth-heading">
      <header className="auth-card-header">
        <Link className="brand-row auth-brand" to="/" aria-label="BookFlow home">
          <span className="brand-mark" aria-hidden="true">B</span><strong>BookFlow</strong>
        </Link>
      </header>

      <div className="auth-copy">
        <h1 id="auth-heading">{isRegister ? "Create your business account" : "Welcome back"}</h1>
        <p className="muted">{isRegister
          ? "Your account is created immediately. POS and Bookings are activated by an administrator upon request."
          : "Access your business or administrator dashboard."}</p>
      </div>

      <form className="auth-fields" onSubmit={submit} aria-busy={submitting}>
        {isRegister && <div className="auth-field">
          <Input id="auth-name" name="name" autoComplete="organization" placeholder="Business or account name" aria-label="Business or account name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} disabled={submitting} required />
        </div>}
        <div className="auth-field">
          <Input id="auth-email" name="email" type="email" autoComplete="email" inputMode="email" placeholder="Email" aria-label="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} disabled={submitting} required />
        </div>
        <div className="auth-field">
          <div className="auth-password-field">
            <Input id="auth-password" name="password" type={showPassword ? "text" : "password"} autoComplete={isRegister ? "new-password" : "current-password"} minLength="8" placeholder="Password" aria-label="Password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} disabled={submitting} required />
            <Button type="button" variant="ghost" size="icon" className="auth-password-toggle" aria-label={showPassword ? "Hide password" : "Show password"} title={showPassword ? "Hide password" : "Show password"} aria-controls="auth-password" aria-pressed={showPassword} disabled={submitting} onClick={() => setShowPassword(v => !v)}>{showPassword ? <FiEyeOff aria-hidden="true" /> : <FiEye aria-hidden="true" />}</Button>
          </div>
        </div>
        {isRegister && <div className={"auth-terms-status" + (termsAccepted ? " accepted" : "")}>
          <span className="auth-terms-status-icon">{termsAccepted ? <FiCheckCircle/> : <FiFileText/>}</span>
          <span className="auth-terms-status-copy">
            <strong>{termsAccepted ? "Terms accepted" : "Terms & Conditions required"}</strong>
            <small>{termsAccepted ? `Version ${termsPage?.version || ""} accepted for this registration.` : "Review the current terms in the pop-up before creating your account."}</small>
          </span>
          <Button type="button" variant="plain" size="sm" onClick={() => setTermsDialogOpen(true)} disabled={!termsPage?.versionId && !termsError}>
            {termsAccepted ? "Review" : "Open"}
          </Button>
        </div>}
      {isRegister && <p className="auth-terms-faq-link"><Link to="/faqs" target="_blank" rel="noreferrer">Questions? Visit our FAQs</Link></p>}
        {isRegister && termsError && <p className="auth-terms-error" role="alert">{termsError}</p>}
        {error && <p className="error" role="alert">{error}</p>}
        <Button type="submit" size="lg" className="auth-submit" disabled={submitting || (isRegister && (!termsPage?.versionId || !termsAccepted))}>
          {submitting ? (isRegister ? "Creating account…" : "Signing in…") : (isRegister ? "Create business account" : "Sign in")}
          {!submitting && <FiArrowRight aria-hidden="true" />}
        </Button>
      </form>


      <div className="auth-footer">
        <span>{isRegister ? "Already have an account?" : "Don't have a business account?"}</span>
        <Button type="button" variant="ghost" className="auth-switch" onClick={() => changeMode(isRegister ? "login" : "register")} disabled={submitting}>
          {isRegister ? "Sign in" : "Sign up"}
        </Button>
      </div>
      <Link className="auth-browse" to="/">Browse services and businesses</Link>
    </section>

    <TermsAcceptanceDialog
      open={termsDialogOpen}
      onOpenChange={handleTermsDialogChange}
      page={termsPage}
      loading={termsLoading}
      error={termsError}
      checked={termsChecked}
      onCheckedChange={setTermsChecked}
      onAccept={acceptTerms}
      accepted={termsAccepted}
      onRetry={retryTerms}
    />
  </main>;
}
