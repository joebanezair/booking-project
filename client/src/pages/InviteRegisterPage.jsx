import { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { api } from "../api.js";

export default function InviteRegisterPage({ user, onAuthenticated }) {
  const { role, inviteKey } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  if (user) return <Navigate to="/dashboard" replace />;
  if (role !== "admin") return <Navigate to="/login" replace />;
  const title = "Create administrator account";

  async function submit(event) {
    event.preventDefault();
    setError("");
    try {
      const data = await api.inviteRegister(role, inviteKey, form);
      localStorage.setItem("booking_token", data.token);
      localStorage.setItem("booking_user", JSON.stringify(data.user));
      onAuthenticated(data.user);
      navigate("/dashboard", { replace: true });
    } catch (e) { setError(e.message); }
  }

  return <main className="auth-shell"><section className="auth-card"><Link className="brand-row" to="/"><span className="brand-mark">B</span><strong>BookFlow</strong></Link><p className="eyebrow">INVITE-ONLY REGISTRATION</p><h1>{title}</h1><p className="muted">This protected page creates an administrator account using the invitation contained in this URL.</p><form onSubmit={submit}><label>Full name<input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></label><label>Email<input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required /></label><label>Password<input type="password" minLength="8" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required /></label>{error && <p className="error">{error}</p>}<button className="primary-button">Create admin account</button></form><Link className="link-button auth-switch" to="/login">Already have an account? Sign in</Link></section></main>;
}
