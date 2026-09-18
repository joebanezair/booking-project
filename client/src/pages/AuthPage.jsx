import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api } from "../api.js";

export default function AuthPage({ onAuthenticated, initialMode = "login" }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState(initialMode);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");

  useEffect(() => { setMode(initialMode); }, [initialMode]);

  async function submit(event) {
    event.preventDefault();
    setError("");
    try {
      const data = mode === "register" ? await api.register(form) : await api.login(form);
      localStorage.setItem("booking_token", data.token);
      localStorage.setItem("booking_user", JSON.stringify(data.user));
      onAuthenticated(data.user);
      navigate(location.state?.from || "/dashboard", { replace: true });
    } catch (e) {
      setError(e.message);
    }
  }

  function switchMode() {
    const next = mode === "login" ? "register" : "login";
    setMode(next);
    navigate(next === "register" ? "/register" : "/login", { replace: true, state: location.state });
  }

  return <main className="auth-shell"><section className="auth-card">
    <Link className="brand-row" to="/"><span className="brand-mark">B</span><strong>BookFlow</strong></Link>
    <p className="eyebrow">{mode === "login" ? "SIGN IN" : "BUSINESS REGISTRATION"}</p>
    <h1>{mode === "login" ? "Welcome back" : "Create your business account"}</h1>
    <p className="muted">{mode === "login" ? "Access your business or administrator dashboard." : "Your business account becomes active immediately. No administrator approval is required."}</p>
    <form onSubmit={submit}>
      {mode === "register" && <label>Business or account name<input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></label>}
      <label>Email<input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required /></label>
      <label>Password<input type="password" minLength="8" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required /></label>
      {error && <p className="error">{error}</p>}
      <button className="primary-button">{mode === "login" ? "Sign in" : "Create business account"}</button>
    </form>
    <button className="link-button auth-switch" onClick={switchMode}>{mode === "login" ? "Register a business" : "Already have an account? Sign in"}</button>
  </section></main>;
}
