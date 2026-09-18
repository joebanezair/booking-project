import { useEffect, useState } from "react";
import { api } from "../api.js";
import { fileToDataUrl } from "../lib.js";

const empty = {
  name: "",
  category: "General",
  description: "",
  location: "",
  email: "",
  phone: "",
  website: "",
  logo: ""
};

export default function BusinessProfileSection({ user, onUserUpdate }) {
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    api.business.mine()
      .then(data => {
        setForm({ ...empty, ...data });
        const next = { ...user, business: { id: data._id, name: data.name, category: data.category } };
        localStorage.setItem("booking_user", JSON.stringify(next));
        onUserUpdate?.(next);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function chooseLogo(file) {
    if (!file) return;
    try {
      const logo = await fileToDataUrl(file);
      setForm(current => ({ ...current, logo }));
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }

  async function save(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      const saved = await api.business.update(form);
      setForm({ ...empty, ...saved });
      const next = { ...user, business: { id: saved._id, name: saved.name, category: saved.category } };
      localStorage.setItem("booking_user", JSON.stringify(next));
      onUserUpdate?.(next);
      setMessage("Business profile updated.");
    } catch (e) {
      setError(e.message);
    }
  }

  if (loading) return <section className="panel business-account-panel"><p>Loading business profile…</p></section>;

  return <section className="panel business-account-panel">
    <div className="panel-title">
      <div><p className="eyebrow">BUSINESS DETAILS</p><h2>{form.name || "Business profile"}</h2></div>
      <span className={`status ${user.accountStatus || "active"}`}>{user.accountStatus || "active"}</span>
    </div>
    {user.accountStatus === "paused" && <p className="warning-note">Your business is paused. You can edit your profile and manage existing bookings, but you cannot publish services or receive new bookings until an admin reactivates it.</p>}
    <form onSubmit={save}>
      <div className="two-col">
        <label>Business name<input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></label>
        <label>Category<input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="General" /></label>
      </div>
      <label>Description<textarea rows="5" maxLength="2000" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label>
      <div className="two-col">
        <label>Location<input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} /></label>
        <label>Contact phone<input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></label>
      </div>
      <div className="two-col">
        <label>Business email<input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required /></label>
        <label>Website<input type="url" placeholder="https://..." value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} /></label>
      </div>
      <div className="image-actions">
        <label className="upload-button">Choose business logo<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={e => chooseLogo(e.target.files?.[0])} /></label>
        {form.logo && <button type="button" className="danger" onClick={() => setForm({ ...form, logo: "" })}>Remove logo</button>}
      </div>
      {error && <p className="error">{error}</p>}
      {message && <p className="success">{message}</p>}
      <button className="primary-button">Save business details</button>
    </form>
  </section>;
}
