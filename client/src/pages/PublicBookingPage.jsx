import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api.js";

export default function PublicBookingPage({ user }) {
  const { userId } = useParams();
  const [params] = useSearchParams();
  const contentId = params.get("content") || "";
  const requestedService = params.get("service") || "Consultation";
  const [page, setPage] = useState(null);
  const [form, setForm] = useState({
    guestName: user?.name || "",
    guestEmail: user?.email || "",
    guestPhone: "",
    locationLabel: "",
    locationLatitude: null,
    locationLongitude: null,
    locationAccuracy: null,
    service: requestedService,
    contentId,
    bookingDate: "",
    notes: ""
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [locationStatus, setLocationStatus] = useState("");
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    api.publicBooking.get(userId).then(setPage).catch(e => setError(e.message));
  }, [userId]);

  function detectLocation() {
    setLocationStatus("");
    if (!navigator.geolocation) {
      setLocationStatus("Location detection is not supported by this browser. You can enter your location manually.");
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      position => {
        const { latitude, longitude, accuracy } = position.coords;
        setForm(current => ({
          ...current,
          locationLabel: current.locationLabel || "Current location",
          locationLatitude: latitude,
          locationLongitude: longitude,
          locationAccuracy: accuracy
        }));
        setLocationStatus(`Location captured (accuracy about ${Math.round(accuracy)} m). You can still edit the location name below.`);
        setLocating(false);
      },
      err => {
        const denied = err.code === err.PERMISSION_DENIED;
        setLocationStatus(denied
          ? "Location permission was not granted. You can enter your address or area manually."
          : "We could not detect your location. You can enter your address or area manually.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  async function submit(e) {
    e.preventDefault();
    try {
      setError("");
      setMessage("");
      const result = await api.publicBooking.create(userId, form);
      setMessage(result.message);
    } catch (e) {
      setError(e.message);
    }
  }

  return <main className="public-shell"><section className="public-card">
    <Link className="brand-row" to="/"><span className="brand-mark">B</span><strong>BookFlow</strong></Link>
    {error && !page ? <p className="error">{error}</p> : !page ? <p>Loading...</p> : <>
      <p className="eyebrow">PUBLIC BOOKING</p>
      <h1>Book time with {page.owner.name}</h1>
      {contentId && <p className="selected-content">Booking for <strong>{requestedService}</strong></p>}

      <form onSubmit={submit}>
        <div className="two-col">
          <label>Your name
            <input value={form.guestName} onChange={e => setForm({ ...form, guestName: e.target.value })} required autoComplete="name" />
          </label>
          <label>Email
            <input type="email" value={form.guestEmail} onChange={e => setForm({ ...form, guestEmail: e.target.value })} required autoComplete="email" />
          </label>
        </div>

        <label>Phone number
          <input
            type="tel"
            value={form.guestPhone}
            onChange={e => setForm({ ...form, guestPhone: e.target.value })}
            placeholder="+63 912 345 6789"
            required
            autoComplete="tel"
          />
        </label>

        <label>Location / service address
          <input
            value={form.locationLabel}
            onChange={e => setForm({ ...form, locationLabel: e.target.value })}
            placeholder="Address, barangay, city, or area"
            autoComplete="street-address"
            maxLength="200"
          />
        </label>
        <div className="row-actions">
          <button className="secondary" type="button" onClick={detectLocation} disabled={locating}>
            {locating ? "Detecting location..." : "Use my current location"}
          </button>
          {form.locationLatitude !== null && form.locationLongitude !== null &&
            <button className="secondary" type="button" onClick={() => {
              setForm(current => ({ ...current, locationLatitude: null, locationLongitude: null, locationAccuracy: null }));
              setLocationStatus("Saved coordinates removed. Your typed location is still kept.");
            }}>Remove detected location</button>}
        </div>
        <p className="muted">Location sharing is optional and only happens after you press the button and approve your browser's permission request.</p>
        {locationStatus && <p className="muted">{locationStatus}</p>}

        {!contentId && <label>Service
          <select value={form.service} onChange={e => setForm({ ...form, service: e.target.value })}>
            {page.services.map(service => <option key={service}>{service}</option>)}
          </select>
        </label>}

        <label>Date & time
          <input type="datetime-local" value={form.bookingDate} onChange={e => setForm({ ...form, bookingDate: e.target.value })} required />
        </label>
        <label>Notes
          <textarea rows="4" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
        </label>

        {error && <p className="error">{error}</p>}
        {message && <p className="success">{message}</p>}
        <button className="primary-button">Request booking</button>
      </form>
    </>}
  </section></main>;
}
