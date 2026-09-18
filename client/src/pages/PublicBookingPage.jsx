import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api.js";

function money(value, currency = "PHP") {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(value || 0);
  } catch {
    return `${currency} ${Number(value || 0).toLocaleString()}`;
  }
}

export default function PublicBookingPage({ user }) {
  const { userId } = useParams();
  const [params] = useSearchParams();
  const requestedContentId = params.get("content") || "";
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
    contentId: requestedContentId,
    bookingDate: "",
    notes: ""
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [locationStatus, setLocationStatus] = useState("");
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    api.publicBooking.get(userId).then(result => {
      setPage(result);
      setForm(current => {
        if (requestedContentId) {
          const selected = result.services.find(service => String(service.id) === String(requestedContentId));
          return selected ? { ...current, service: selected.title, contentId: selected.id } : current;
        }
        const first = result.services[0];
        return first ? { ...current, service: first.title, contentId: first.id || "" } : current;
      });
    }).catch(e => setError(e.message));
  }, [userId, requestedContentId]);

  const selectedService = page?.services?.find(service =>
    (form.contentId && String(service.id) === String(form.contentId)) ||
    (!form.contentId && service.title === form.service)
  );

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

  function chooseService(index) {
    const selected = page.services[Number(index)];
    if (!selected) return;
    setForm(current => ({ ...current, service: selected.title, contentId: selected.id || "" }));
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

  const selectedIndex = page?.services?.findIndex(service =>
    (form.contentId && String(service.id) === String(form.contentId)) ||
    (!form.contentId && service.title === form.service)
  );

  return <main className="public-shell"><section className="public-card">
    <Link className="brand-row" to="/"><span className="brand-mark">B</span><strong>BookFlow</strong></Link>
    {error && !page ? <p className="error">{error}</p> : !page ? <p>Loading...</p> : <>
      <p className="eyebrow">PUBLIC BOOKING</p>
      <h1>Book time with {page.owner.name}</h1>
      {selectedService && <p className="selected-content">Booking for <strong>{selectedService.title}</strong> · {money(selectedService.price, selectedService.currency)}</p>}

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

        {!requestedContentId && <label>Service
          <select value={selectedIndex >= 0 ? String(selectedIndex) : "0"} onChange={e => chooseService(e.target.value)}>
            {page.services.map((service, index) => <option value={index} key={service.id || `${service.title}-${index}`}>{service.title} — {money(service.price, service.currency)}</option>)}
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
