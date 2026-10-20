import { useEffect, useState } from "react";
import { FiCalendar, FiCheck, FiGlobe, FiImage, FiInfo, FiSave, FiUploadCloud, FiUserCheck } from "react-icons/fi";
import { Button } from "./ui/button.jsx";
import { Input } from "./ui/input.jsx";
import { Textarea } from "./ui/textarea.jsx";
import { Image } from "./ui/image.jsx";
import { Label } from "./ui/label.jsx";
import { api } from "../api.js";
import { fileToDataUrl } from "../lib.js";
import "../business-logo-preview.css";

const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const defaultHours = () => days.map((_, day) => ({
  day, enabled: day >= 1 && day <= 5, start: "09:00", end: "17:00"
}));
const empty = {
  name: "", category: "General", description: "", location: "", email: "",
  phone: "", website: "", logo: "", timezone: "Asia/Manila",
  workingHours: defaultHours(), blackoutDates: [], leadTimeMinutes: 60,
  maxAdvanceDays: 60, slotIntervalMinutes: 30
};

// A relative GridFS media path must use the configured API origin when the
// frontend and API are hosted separately.
function businessLogoUrl(value) {
  const logo = String(value || "").trim();
  const apiBase = String(import.meta.env.VITE_API_URL || "/api");
  if (logo.startsWith("/api/media/") && /^https?:\/\//i.test(apiBase)) {
    try { return new URL(logo, apiBase).href; } catch { return logo; }
  }
  return logo;
}

function completeForm(data) {
  return {
    ...empty, ...data,
    workingHours: data.workingHours?.length ? data.workingHours : defaultHours(),
    blackoutDates: data.blackoutDates || []
  };
}

export default function BusinessProfileSection({ user, onUserUpdate }) {
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [logoLoadFailed, setLogoLoadFailed] = useState(false);

  useEffect(() => setLogoLoadFailed(false), [form.logo]);

  useEffect(() => {
    api.business.mine().then(data => {
      setForm(completeForm(data));
      const next = {
        ...user, business: { id: data._id, name: data.name, category: data.category }
      };
      localStorage.setItem("booking_user", JSON.stringify(next));
      onUserUpdate?.(next);
    }).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);

  function patch(field, value) {
    setForm(previous => ({ ...previous, [field]: value }));
    setMessage("");
  }

  async function chooseLogo(file) {
    if (!file) return;
    try {
      const logo = await fileToDataUrl(file);
      patch("logo", logo);
      setLogoLoadFailed(false);
      setError("");
    } catch (e) { setError(e.message); }
  }

  async function save(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const saved = await api.business.update({
        ...form,
        leadTimeMinutes: Number(form.leadTimeMinutes),
        maxAdvanceDays: Number(form.maxAdvanceDays),
        slotIntervalMinutes: Number(form.slotIntervalMinutes)
      });
      setForm(completeForm(saved));
      const next = {
        ...user, business: { id: saved._id, name: saved.name, category: saved.category }
      };
      localStorage.setItem("booking_user", JSON.stringify(next));
      onUserUpdate?.(next);
      setMessage("Business details saved successfully.");
    } catch (e) {
      setError(e.message);
    } finally { setSaving(false); }
  }

  if (loading) return <section className="panel business-account-panel business-profile-redesign">
    <p role="status" className="business-loading">Loading business profile…</p>
  </section>;

  const logoSrc = businessLogoUrl(form.logo);
  const hasLogo = Boolean(form.logo) && !logoLoadFailed;
  const accountStatus = user.accountStatus || "active";

  return <section className="panel business-account-panel business-profile-redesign">
    <div className="business-identity-banner">
      <div className="business-identity-main">
        <div className="business-logo-image">
          {hasLogo
            ? <Image src={logoSrc} alt={`${form.name || "Business"} logo`} onError={() => setLogoLoadFailed(true)} />
            : <FiImage aria-hidden="true" />}
        </div>
        <div className="business-identity-text">
          <span className="business-identity-kicker"><FiUserCheck aria-hidden="true" /> Your business profile</span>
          <h2>{form.name || "Business profile"}</h2>
          <p>Customize the details customers see when they discover your business.</p>
        </div>
      </div>
      <span className={`status business-account-status ${accountStatus}`}>
        <span className="business-status-dot" aria-hidden="true" />{accountStatus}
      </span>
    </div>

    {accountStatus === "paused" && <p className="warning-note business-account-warning">
      Your business is paused. You can edit your profile and manage existing bookings, but you cannot publish services or receive new bookings until an admin reactivates it.
    </p>}

    <form className="business-settings-form" onSubmit={save}>
      <section className="business-settings-section" aria-labelledby="business-details-heading">
        <div className="business-section-heading">
          <span className="business-section-icon" aria-hidden="true"><FiUserCheck /></span>
          <div>
            <h3 id="business-details-heading">Business information</h3>
            <p>Introduce your business and describe what you offer.</p>
          </div>
        </div>
        <div className="business-fields-grid">
          <Label>Business name
            <Input value={form.name} onChange={e => patch("name", e.target.value)} maxLength="120" autoComplete="organization" required />
          </Label>
          <Label>Category
            <Input value={form.category} onChange={e => patch("category", e.target.value)} maxLength="80" placeholder="e.g. Retail, Services" />
          </Label>
          <Label className="business-field-wide">Description
            <Textarea rows="4" maxLength="2000" value={form.description}
              onChange={e => patch("description", e.target.value)} placeholder="Tell customers what makes your business unique..." />
            <span className="business-field-hint">{form.description.length.toLocaleString()} / 2,000 characters</span>
          </Label>
        </div>
      </section>

      <section className="business-settings-section" aria-labelledby="business-contact-heading">
        <div className="business-section-heading">
          <span className="business-section-icon" aria-hidden="true"><FiGlobe /></span>
          <div>
            <h3 id="business-contact-heading">Contact & online presence</h3>
            <p>Help customers find you and get in touch.</p>
          </div>
        </div>
        <div className="business-fields-grid">
          <Label>Location
            <Input value={form.location} onChange={e => patch("location", e.target.value)}
              maxLength="160" autoComplete="street-address" placeholder="City, province, or full address" />
          </Label>
          <Label>Contact phone
            <Input type="tel" value={form.phone} onChange={e => patch("phone", e.target.value)}
              maxLength="40" autoComplete="tel" placeholder="Your business contact number" />
          </Label>
          <Label>Business email
            <Input type="email" value={form.email} onChange={e => patch("email", e.target.value)}
              autoComplete="email" required />
          </Label>
          <Label>Website
            <Input type="url" value={form.website} onChange={e => patch("website", e.target.value)}
              placeholder="https://example.com" autoComplete="url" />
          </Label>
        </div>
      </section>

      <section className="business-settings-section business-brand-section" aria-labelledby="business-brand-heading">
        <div className="business-section-heading">
          <span className="business-section-icon" aria-hidden="true"><FiImage /></span>
          <div>
            <h3 id="business-brand-heading">Branding</h3>
            <p>Your logo helps customers recognize your business.</p>
          </div>
        </div>
        <div className="business-logo-upload-card">
          <div className="business-brand-preview" aria-label={hasLogo ? "Current logo preview" : "No business logo uploaded"}>
            {hasLogo
              ? <Image src={logoSrc} alt={`${form.name || "Business"} logo preview`} onError={() => setLogoLoadFailed(true)} />
              : <FiImage aria-hidden="true" />}
          </div>
          <div className="business-logo-upload-copy">
            <strong>{form.logo ? "Your business logo" : "Add your business logo"}</strong>
            <p>JPEG, PNG, WebP or GIF · Max 2 MB</p>
            <p className="business-logo-subtle">Preview your logo here before saving changes.</p>
          </div>
          <div className="business-logo-actions">
            <Label className="upload-button business-upload-button">
              <FiUploadCloud aria-hidden="true" />
              {form.logo ? "Change logo" : "Upload logo"}
              <Input type="file" accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={e => { void chooseLogo(e.target.files?.[0]); e.target.value = ""; }}
                className="business-logo-file-input" disabled={saving} />
            </Label>
            {form.logo && <Button type="button" variant="outline" className="business-remove-logo"
              disabled={saving} onClick={() => patch("logo", "")}>Remove</Button>}
          </div>
        </div>
        {form.logo && logoLoadFailed && <p role="alert" className="warning-note business-logo-error">
          The saved logo couldn't be displayed. Upload it again or check your media server.
        </p>}
      </section>

      <div className="business-schedule-note">
        <FiCalendar aria-hidden="true" />
        <p><strong>Booking availability</strong> — Manage your schedule, time zone, notice periods, and blackout dates under <strong>Bookings → Availability</strong>.</p>
      </div>

      {(error || message) && <div className="business-feedback" aria-live="polite">
        {error && <p role="alert" className="error">{error}</p>}
        {message && <p role="status" className="success"><FiCheck aria-hidden="true" /> {message}</p>}
      </div>}

      <footer className="business-save-footer">
        <p><FiInfo aria-hidden="true" /> Updates are visible after you save.</p>
        <Button type="submit" disabled={saving} className="primary-button business-save-button">
          <FiSave aria-hidden="true" /> {saving ? "Saving…" : "Save changes"}
        </Button>
      </footer>
    </form>
  </section>;
}
