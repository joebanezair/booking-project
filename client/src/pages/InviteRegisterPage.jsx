import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { FiEye, FiEyeOff } from "react-icons/fi";
import { Button } from "../components/ui/button.jsx";
import { Input } from "../components/ui/input.jsx";
import { api } from "../api.js";

export default function InviteRegisterPage({ user, onAuthenticated }) {
  const { inviteKey } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [termsPage, setTermsPage] = useState(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loadingTerms, setLoadingTerms] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    api.platformContent.public("terms").then(page => {
      if (active) setTermsPage(page);
    }).catch(e => {
      if (active) setError(e.message || "Unable to load the current Terms & Conditions.");
    }).finally(() => {
      if (active) setLoadingTerms(false);
    });
    return () => { active = false; };
  }, []);

  if (user) return <Navigate to="/dashboard" replace />;

  async function submit(event) {
    event.preventDefault();
    if (submitting || !termsPage?.versionId || !termsAccepted) return;
    setSubmitting(true);
    setError("");
    try {
      const data = await api.inviteAdmin(inviteKey, { ...form, termsVersionId: termsPage.versionId });
      localStorage.setItem("booking_token", data.token);
      localStorage.setItem("booking_user", JSON.stringify(data.user));
      onAuthenticated(data.user);
      navigate("/dashboard", { replace: true });
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return <main className="auth-shell"><section className="auth-card">
    <Link className="brand-row auth-brand" to="/"><span className="brand-mark">B</span><strong>BookFlow</strong></Link>
    <p className="eyebrow">ADMIN REGISTRATION</p>
    <h1>Create administrator account</h1>
    <p className="muted">This protected URL creates a platform administrator. Normal public registration always creates a business account.</p>
    <form className="auth-fields" onSubmit={submit}>
      <div className="auth-field">
        <Input name="name" autoComplete="name" placeholder="Full name" aria-label="Full name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} disabled={submitting} required />
      </div>
      <div className="auth-field">
        <Input name="email" type="email" autoComplete="email" placeholder="Email" aria-label="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} disabled={submitting} required />
      </div>
      <div className="auth-field">
        <div className="auth-password-field">
          <Input name="password" type={showPassword ? "text" : "password"} autoComplete="new-password" minLength="8" placeholder="Password" aria-label="Password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} disabled={submitting} required />
          <Button type="button" variant="ghost" size="icon" className="auth-password-toggle" aria-label={showPassword ? "Hide password" : "Show password"} title={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} disabled={submitting} onClick={() => setShowPassword(value => !value)}>{showPassword ? <FiEyeOff aria-hidden="true" /> : <FiEye aria-hidden="true" />}</Button>
        </div>
      </div>
      <div className="auth-terms-consent">
        <label className="auth-terms-check">
          <input type="checkbox" checked={termsAccepted} onChange={event => setTermsAccepted(event.target.checked)} disabled={submitting || loadingTerms || !termsPage?.versionId} required />
          <span>I have read and agree to the <Link to="/terms" target="_blank" rel="noreferrer">Terms & Conditions</Link>.</span>
        </label>
        <p className="auth-terms-note"><Link to="/faqs" target="_blank" rel="noreferrer">Frequently Asked Questions</Link>{termsPage?.version ? ` · Terms version ${termsPage.version}` : ""}</p>
        {loadingTerms && <p className="auth-terms-note">Loading current terms…</p>}
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <Button type="submit" size="lg" className="auth-submit" disabled={submitting || loadingTerms || !termsPage?.versionId || !termsAccepted}>
        {submitting ? "Creating administrator account…" : "Create admin account"}
      </Button>
    </form>
    <Link className="link-button auth-switch" to="/login">Already have an account? Sign in</Link>
  </section></main>;
}
