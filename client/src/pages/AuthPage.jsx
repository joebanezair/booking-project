import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { FiArrowRight } from "react-icons/fi";
import { api } from "../api.js";
import { Button } from "../components/ui/button.jsx";
import { Input } from "../components/ui/input.jsx";

export default function AuthPage({ onAuthenticated, initialMode = "login" }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState(initialMode);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setMode(initialMode);
    setError("");
    setShowPassword(false);
  }, [initialMode]);

  async function submit(event) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const data = mode === "register" ? await api.register(form) : await api.login(form);
      localStorage.setItem("booking_token", data.token);
      localStorage.setItem("booking_user", JSON.stringify(data.user));
      onAuthenticated(data.user);
      navigate(location.state?.from || "/dashboard", { replace: true });
    } catch (e) {
      setError(e.message || "Unable to complete this request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function changeMode(next) {
    if (submitting || next === mode) return;
    setMode(next);
    setError("");
    setShowPassword(false);
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
          ? "Your business account becomes active immediately. No administrator approval is required."
          : "Access your business or administrator dashboard."}</p>
      </div>

      <form className="auth-fields" onSubmit={submit} aria-busy={submitting}>
        {isRegister && <label htmlFor="auth-name">Business or account name
          <Input id="auth-name" name="name" autoComplete="organization" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} disabled={submitting} required />
        </label>}
        <label htmlFor="auth-email">Email
          <Input id="auth-email" name="email" type="email" autoComplete="email" inputMode="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} disabled={submitting} required />
        </label>
        <div className="auth-field">
          <label htmlFor="auth-password">Password</label>
          <div className="auth-password-field">
            <Input id="auth-password" name="password" type={showPassword ? "text" : "password"} autoComplete={isRegister ? "new-password" : "current-password"} minLength="8" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} disabled={submitting} required />
            <Button type="button" variant="ghost" className="auth-password-toggle" aria-label={showPassword ? "Hide password" : "Show password"} aria-controls="auth-password" aria-pressed={showPassword} disabled={submitting} onClick={() => setShowPassword(v => !v)}>{showPassword ? "Hide" : "Show"}</Button>
          </div>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <Button type="submit" size="lg" className="auth-submit" disabled={submitting}>
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
  </main>;
}
